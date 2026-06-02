import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { computePopoverPosition, toAnchorRect } from '../../lib/popoverPosition'
import { fetchTags, type TagRecord } from '../../services/tags'
import { showErrorToast } from '../../utils/toast'

const POPOVER_W = 260
const POPOVER_H = 220

export type DashboardTagPopoverProps = {
  companyId: number
  selectedTagId: number | null
  onTagSaved: () => void
  title: string
  hint: string
  triggerAriaLabel: string
  dialogAriaLabel: string
  saveTag: (companyId: number, tagId: number) => Promise<unknown>
  editButtonClassName?: string
}

const DashboardTagPopover = ({
  companyId,
  selectedTagId,
  onTagSaved,
  title,
  hint,
  triggerAriaLabel,
  dialogAriaLabel,
  saveTag,
  editButtonClassName = 'dashboard-preview-edit',
}: DashboardTagPopoverProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [tags, setTags] = useState<TagRecord[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [saving, setSaving] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const updateAnchorFromTrigger = useCallback(() => {
    const el = triggerRef.current
    if (!el) return null
    return toAnchorRect(el.getBoundingClientRect())
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
    void fetchTags('', companyId)
      .then(setTags)
      .catch(() => {
        setTags([])
        showErrorToast('Could not load tags.')
      })
      .finally(() => setLoadingTags(false))
  }, [open, companyId])

  const repositionPopover = useCallback(() => {
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
  }, [updateAnchorFromTrigger])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => repositionPopover()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open, repositionPopover])

  const selectTag = async (tagId: number) => {
    if (saving || tagId === selectedTagId) return
    setSaving(true)
    try {
      await saveTag(companyId, tagId)
      onTagSaved()
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
        className={editButtonClassName}
        aria-label={triggerAriaLabel}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPopover())}
      >
        <i className="bi bi-pencil-square" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <>
            <div className="dashboard-profit-tag-popover-backdrop" aria-hidden="true" />
            <div
              ref={popoverRef}
              className="dashboard-profit-tag-popover"
              style={{ top: position.top, left: position.left }}
              role="dialog"
              aria-label={dialogAriaLabel}
            >
              <div className="dashboard-profit-tag-popover__card">
                <div className="dashboard-profit-tag-popover__header">
                  <span className="dashboard-profit-tag-popover__title">{title}</span>
                  <button
                    type="button"
                    className="btn-close btn-close-white btn-close-sm"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                  />
                </div>
                <div className="dashboard-profit-tag-popover__body">
                  <p className="dashboard-profit-tag-popover__hint small text-muted mb-2">
                    {hint}
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

export default DashboardTagPopover
