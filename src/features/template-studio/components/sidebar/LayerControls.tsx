import type { LayerDirection } from '../../lib/layerOrder'
import { useTemplateStudioStore } from '../../store/templateStudioStore'

type LayerControlsProps = {
  /** Icon-only buttons for the top toolbar. */
  compact?: boolean
}

const ACTIONS: {
  direction: LayerDirection
  label: string
  shortLabel: string
  icon: string
}[] = [
  { direction: 'front', label: 'Bring to front', shortLabel: 'To front', icon: 'bi-chevron-double-up' },
  { direction: 'forward', label: 'Bring forward', shortLabel: 'Forward', icon: 'bi-arrow-up' },
  { direction: 'backward', label: 'Send backward', shortLabel: 'Backward', icon: 'bi-arrow-down' },
  { direction: 'back', label: 'Send to back', shortLabel: 'To back', icon: 'bi-chevron-double-down' },
]

const LayerControls = ({ compact = false }: LayerControlsProps) => {
  const selectedIds = useTemplateStudioStore((s) => s.selectedIds)
  const layerSelected = useTemplateStudioStore((s) => s.layerSelected)

  if (!selectedIds.length) return null

  return (
    <div
      className={`ts-layer-controls${compact ? ' ts-layer-controls--compact' : ''}`}
      role="group"
      aria-label="Layer order"
    >
      {!compact && <p className="small text-muted mb-2 mb-md-1">Arrange</p>}
      <div className={compact ? 'ts-layer-controls__row' : 'd-grid gap-1'}>
        {ACTIONS.map(({ direction, label, shortLabel, icon }) => (
          <button
            key={direction}
            type="button"
            className={
              compact
                ? 'ts-icon-btn ts-icon-btn--sm'
                : 'btn btn-sm btn-outline-secondary d-flex align-items-center gap-2'
            }
            title={label}
            aria-label={label}
            onClick={() => layerSelected(direction)}
          >
            <i className={`bi ${icon}`} aria-hidden="true" />
            {!compact && <span>{shortLabel}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default LayerControls
