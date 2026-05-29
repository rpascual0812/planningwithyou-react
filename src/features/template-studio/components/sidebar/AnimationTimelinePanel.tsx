import { useTemplateStudioStore } from '../../store/templateStudioStore'
import type { AnimationConfig, CanvasElement } from '../../types/schema'

const ENTRANCES = ['fade', 'slide-up', 'slide-down', 'zoom', 'none']

const AnimationTimelinePanel = () => {
  const page = useTemplateStudioStore((s) => s.getActivePage())
  const selectedIds = useTemplateStudioStore((s) => s.selectedIds)
  const updateElement = useTemplateStudioStore((s) => s.updateElement)
  const updatePageMeta = useTemplateStudioStore((s) => s.updatePageMeta)

  const selected = selectedIds.length === 1
    ? page.elements.find((el) => el.id === selectedIds[0])
    : undefined

  const patchAnimation = (el: CanvasElement, anim: Partial<AnimationConfig>) => {
    updateElement(
      el.id,
      {
        animation: { ...el.animation, ...anim },
      } as Partial<CanvasElement>,
      { preserveCanvas: true },
    )
  }

  return (
    <div className="ts-animation-panel">
      <p className="text-muted small">
        Page transition and per-element entrance animations for the published site.
      </p>
      <div className="mb-3">
        <label className="form-label small">Page transition</label>
        <select
          className="form-select form-select-sm"
          value={page.transition ?? 'none'}
          onChange={(e) => updatePageMeta({ transition: e.target.value })}
        >
          {ENTRANCES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {selected ? (
        <div className="mb-3 border rounded p-2 bg-light">
          <div className="small fw-semibold mb-2">{selected.name}</div>
          <label className="form-label small">Entrance</label>
          <select
            className="form-select form-select-sm mb-2"
            value={selected.animation?.entrance ?? 'none'}
            onChange={(e) => patchAnimation(selected, { entrance: e.target.value })}
          >
            {ENTRANCES.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <label className="form-label small">Delay (ms)</label>
          <input
            type="number"
            className="form-control form-control-sm mb-2"
            min={0}
            step={100}
            value={selected.animation?.delayMs ?? 0}
            onChange={(e) => patchAnimation(selected, { delayMs: Number(e.target.value) })}
          />
          <label className="form-label small">Duration (ms)</label>
          <input
            type="number"
            className="form-control form-control-sm"
            min={0}
            step={100}
            value={selected.animation?.durationMs ?? 600}
            onChange={(e) => patchAnimation(selected, { durationMs: Number(e.target.value) })}
          />
        </div>
      ) : (
        <p className="text-muted small">Select one element to edit its animation.</p>
      )}

      <div className="ts-timeline-track mt-3">
        <div className="small text-muted mb-1">Timeline — {page.name}</div>
        <div className="ts-timeline-lanes">
          {page.elements.map((el) => {
            const delay = el.animation?.delayMs ?? 0
            const duration = el.animation?.durationMs ?? 600
            const max = 3000
            const left = `${(delay / max) * 100}%`
            const width = `${Math.min(100, (duration / max) * 100)}%`
            return (
              <div key={el.id} className="ts-timeline-lane d-flex align-items-center gap-2 mb-1">
                <span className="small text-truncate" style={{ width: 72 }}>{el.name}</span>
                <div className="flex-grow-1 position-relative bg-light rounded" style={{ height: 18 }}>
                  <div
                    className="ts-timeline-bar bg-primary rounded"
                    style={{ marginLeft: left, width, height: '100%', opacity: 0.85 }}
                    title={`${el.animation?.entrance ?? 'none'} ${delay}ms`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AnimationTimelinePanel
