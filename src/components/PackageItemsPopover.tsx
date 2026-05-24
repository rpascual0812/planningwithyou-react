import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import {
  computePopoverPosition,
  toAnchorRect,
  type AnchorRect,
} from '../lib/popoverPosition'
import { formatPackagePrice, type PackageItemRecord } from '../services/packages'

const POPOVER_ESTIMATE_W = 320
const POPOVER_ESTIMATE_H = 280

type PackageItemsPopoverProps = {
  packageDescription: string
  tierName: string
  items: PackageItemRecord[]
  loading?: boolean
  disabled?: boolean
}

function countItems(items: PackageItemRecord[]): number {
  return items.reduce((sum, item) => sum + 1 + countItems(item.children ?? []), 0)
}

function renderItemRows(items: PackageItemRecord[], depth = 0): ReactElement[] {
  return items.flatMap((item) => {
    const priceLine = formatPackagePrice(item.price)
    const row = (
      <li
        key={item.id}
        className={`package-items-popover__item package-items-popover__item--depth-${Math.min(depth, 3)}`}
        role="treeitem"
        aria-level={depth + 1}
      >
        {depth > 0 ? (
          <span className="package-items-popover__tree-icon" aria-hidden="true">
            <i className="bi bi-arrow-return-right" />
          </span>
        ) : (
          <span className="package-items-popover__bullet" aria-hidden="true" />
        )}
        <div className="package-items-popover__item-body">
          <span className="package-items-popover__item-title">{item.title}</span>
          {priceLine !== '—' && (
            <span className="package-items-popover__item-price">{priceLine}</span>
          )}
        </div>
      </li>
    )
    return [row, ...renderItemRows(item.children ?? [], depth + 1)]
  })
}

export default function PackageItemsPopover({
  packageDescription,
  tierName,
  items,
  loading = false,
  disabled = false,
}: PackageItemsPopoverProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
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
        POPOVER_ESTIMATE_W,
        POPOVER_ESTIMATE_H,
        window.innerWidth,
        window.innerHeight,
      ),
    )
    setOpen(true)
  }, [updateAnchorFromTrigger])

  const togglePopover = useCallback(() => {
    if (disabled || loading) return
    if (open) {
      setOpen(false)
      return
    }
    openPopover()
  }, [disabled, loading, open, openPopover])

  useEffect(() => {
    if (!open || !popoverRef.current || !anchor) return
    const el = popoverRef.current
    const w = el.offsetWidth || POPOVER_ESTIMATE_W
    const h = el.offsetHeight || POPOVER_ESTIMATE_H
    setPosition(
      computePopoverPosition(anchor, w, h, window.innerWidth, window.innerHeight),
    )
  }, [open, anchor, items, packageDescription])

  useEffect(() => {
    if (!open) return
    const reposition = () => {
      const rect = updateAnchorFromTrigger()
      if (!rect || !popoverRef.current) return
      const el = popoverRef.current
      setPosition(
        computePopoverPosition(
          rect,
          el.offsetWidth || POPOVER_ESTIMATE_W,
          el.offsetHeight || POPOVER_ESTIMATE_H,
          window.innerWidth,
          window.innerHeight,
        ),
      )
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, updateAnchorFromTrigger])

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

  const itemCount = countItems(items)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="package-items-popover-trigger"
        aria-label="View package items"
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={togglePopover}
      >
        <i className="bi bi-list-ul" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="package-items-popover"
            style={{ top: position.top, left: position.left }}
          >
            <div className="package-items-popover__card" role="dialog" aria-label="Package items">
              <div className="package-items-popover__header">
                <div className="package-items-popover__header-icon" aria-hidden="true">
                  <i className="bi bi-box-seam" />
                </div>
                <div className="package-items-popover__header-text">
                  <span className="package-items-popover__eyebrow">Package</span>
                  <strong className="package-items-popover__title">{tierName}</strong>
                  {packageDescription.trim() && (
                    <span className="package-items-popover__subtitle">
                      {packageDescription}
                    </span>
                  )}
                </div>
              </div>

              <div className="package-items-popover__body">
                {loading ? (
                  <p className="package-items-popover__empty">Loading items…</p>
                ) : items.length === 0 ? (
                  <p className="package-items-popover__empty">No items in this package.</p>
                ) : (
                  <>
                    <p className="package-items-popover__meta">
                      {itemCount} item{itemCount !== 1 ? 's' : ''} included
                    </p>
                    <ul className="package-items-popover__list" role="tree">
                      {renderItemRows(items)}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
