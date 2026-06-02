import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  computePopoverPosition,
  toAnchorRect,
  type AnchorRect,
} from '../../lib/popoverPosition'
import { saveProfitProgressTagConfig } from '../../services/config'
import { fetchTags, type TagRecord } from '../../services/tags'
import { showErrorToast } from '../../utils/toast'

const POPOVER_W = 260
const POPOVER_H = 220

type ProfitProgressTagPopoverProps = {
  selectedTagId: number | null
  onTagSaved: () => void
}

const ProfitProgressTagPopover = ({
  selectedTagId,
  onTagSaved,
}: ProfitProgressTagPopoverProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [tags, setTags] = useState<TagRecord[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [saving, setSaving] = useState(false)
  const [anchor, setAnchor] = useState<AnchorRect | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const updateAnchorFromTrigger = useCallback(() => {
    const el = triggerRef.current
    if (!el) return null
    const rect = toAnchorRect(el.getBoundingClientRect())
    setAnchor(rect)
    return rect
  }, [])

  const openPopover = useCallback(() => {
    const rect = updateAnchorFromTrigger()
    if (!rect) return
    setPosition(
      computePopoverPosition(
        rect,
        POPOVER_W,
        POPOVER_H,
        window.innerWidth,
        window.innerHeight,
      ),
    )
    setOpen(true)
  }, [updateAnchorFromTrigger])

  useEffect(() => {
    if (!open) return
    setLoadingTags(true)
    void fetchTags()
      .then(setTags)
      .catch(() => {
        setTags([])
        showErrorToast('Could not load tags.')
      })
      .finally(() => setLoadingTags(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  useEffect(() => {
    if (!open || !anchor) return
    const onResize = () => {
      const rect = updateAnchorFromTrigger()
      if (!rect) return
      setPosition(
        computePopoverPosition(
          rect,
          POPOVER_W,
          POPOVER_H,
          window.innerWidth,
          window.innerHeight,
        ),
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, anchor, updateAnchorFromTrigger])

  const selectTag = async (tagId: number) => {
    if (saving || tagId === selectedTagId) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      await saveProfitProgressTagConfig(tagId)
      onTagSaved()
      setOpen(false)
    } catch {
      showErrorToast('Could not save tag.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="dashboard-preview-edit"
        aria-label="Edit profit progress tag"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPopover())}
      >
        <i className="bi bi-pencil-square" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <>
            <div
              className="dashboard-profit-tag-popover-backdrop"
              aria-hidden="true"
              onClick={() => setOpen(false)}
            />
            <div
              ref={popoverRef}
              className="dashboard-profit-tag-popover"
              style={{ top: position.top, left: position.left }}
              role="dialog"
              aria-label="Select profit progress tag"
            >
              <div className="dashboard-profit-tag-popover__card">
                <div className="dashboard-profit-tag-popover__header">
                  <span className="dashboard-profit-tag-popover__title">Profit tag</span>
                  <button
                    type="button"
                    className="btn-close btn-close-white btn-close-sm"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  />
                </div>
                <div className="dashboard-profit-tag-popover__body">
                  <p className="dashboard-profit-tag-popover__hint small text-muted mb-2">
                    Sum booking totals for statuses with this tag.
                  </p>
                  {loadingTags ? (
                    <div className="text-muted small py-2">Loading tags…</div>
                  ) : tags.length === 0 ? (
                    <div className="text-muted small py-2">
                      No tags yet. Add tags in Booking Settings → Statuses.
                    </div>
                  ) : (
                    <ul className="dashboard-profit-tag-popover__list list-unstyled mb-0">
                      {tags.map((tag) => (
                        <li key={tag.id}>
                          <button
                            type="button"
                            className={`dashboard-profit-tag-popover__option${
                              selectedTagId === tag.id ? ' is-selected' : ''
                            }`}
                            disabled={saving}
                            onClick={() => void selectTag(tag.id)}
                          >
                            <span>{tag.tag}</span>
                            {selectedTagId === tag.id && (
                              <i className="bi bi-check-lg" aria-hidden="true" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}

export default ProfitProgressTagPopover
