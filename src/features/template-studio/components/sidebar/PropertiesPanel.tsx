import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/countdownDate'
import { COUNTDOWN_STYLE_OPTIONS, normalizeCountdownStyle } from '../../lib/countdownStyles'
import { GOOGLE_FONTS } from '../../hooks/useGoogleFonts'
import { normalizeRsvpElement } from '../../lib/rsvpFields'
import { useTemplateStudioStore } from '../../store/templateStudioStore'
import LayerControls from './LayerControls'
import type {
  CanvasElement,
  CountdownElement,
  ImageElement,
  MapElement,
  PageBackground,
  RsvpElement,
  TextElement,
  VideoElement,
} from '../../types/schema'

const PropertiesPanel = ({ embedded = false }: { embedded?: boolean }) => {
  const page = useTemplateStudioStore((s) => s.getActivePage())
  const selectedIds = useTemplateStudioStore((s) => s.selectedIds)
  const updateElement = useTemplateStudioStore((s) => s.updateElement)
  const updatePageBackground = useTemplateStudioStore((s) => s.updatePageBackground)
  const deleteSelected = useTemplateStudioStore((s) => s.deleteSelected)
  const duplicateSelected = useTemplateStudioStore((s) => s.duplicateSelected)
  const openRsvpFormEditor = useTemplateStudioStore((s) => s.openRsvpFormEditor)

  const selected =
    selectedIds.length === 1
      ? page.elements.find((el) => el.id === selectedIds[0])
      : undefined

  const patchElement = (patch: Partial<CanvasElement>) => {
    if (!selected) return
    updateElement(selected.id, patch, { preserveCanvas: true })
  }

  return (
    <div className={embedded ? '' : 'ts-sidebar ts-sidebar--right border-start bg-white p-3 overflow-auto'} aria-label="Properties">
      {!embedded && (
        <h6 className="text-uppercase text-muted small fw-semibold mb-3">Properties</h6>
      )}

      {!selected && (
        <BackgroundEditor background={page.background} onChange={updatePageBackground} />
      )}

      {selectedIds.length > 1 && (
        <>
          <p className="text-muted small">{selectedIds.length} elements selected</p>
          <LayerControls />
          <div className="d-grid gap-2 mt-3">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={duplicateSelected}>
              Duplicate
            </button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={deleteSelected}>
              Delete
            </button>
          </div>
        </>
      )}

      {selected && (
        <>
          <div className="mb-3">
            <label className="form-label small">Name</label>
            <input
              className="form-control form-control-sm"
              value={selected.name}
              onChange={(e) => patchElement({ name: e.target.value })}
            />
          </div>

          <TransformEditor
            transform={selected.transform}
            onChange={(t) => patchElement({ transform: { ...selected.transform, ...t } })}
          />

          {selected.type === 'text' && (
            <TextProperties
              element={selected}
              onChange={(patch) => patchElement(patch)}
            />
          )}
          {selected.type === 'image' && (
            <ImageProperties element={selected} onChange={(patch) => patchElement(patch)} />
          )}
          {selected.type === 'video' && (
            <VideoProperties element={selected} onChange={(patch) => patchElement(patch)} />
          )}
          {selected.type === 'map' && (
            <MapProperties element={selected} onChange={(patch) => patchElement(patch)} />
          )}
          {selected.type === 'countdown' && (
            <CountdownProperties element={selected} onChange={(patch) => patchElement(patch)} />
          )}
          {selected.type === 'rsvp' && (
            <RsvpProperties
              element={selected}
              onChange={(patch) => patchElement(patch)}
              onEditForm={() => openRsvpFormEditor(selected.id)}
            />
          )}

          <LayerControls />

          <div className="d-grid gap-2 mt-3">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={duplicateSelected}>
              Duplicate
            </button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={deleteSelected}>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function CountdownProperties({
  element,
  onChange,
}: {
  element: CountdownElement
  onChange: (patch: Partial<CountdownElement>) => void
}) {
  const style = normalizeCountdownStyle(element.style)
  return (
    <>
      <div className="mb-2">
        <label className="form-label small">Style</label>
        <select
          className="form-select form-select-sm"
          value={style}
          onChange={(e) => onChange({ style: normalizeCountdownStyle(e.target.value as CountdownElement['style']) })}
        >
          {COUNTDOWN_STYLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <label className="form-label small">Label</label>
        <input
          className="form-control form-control-sm"
          value={element.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Days until our wedding"
        />
      </div>
      <div className="mb-2">
        <label className="form-label small">Target date &amp; time</label>
        <input
          type="datetime-local"
          className="form-control form-control-sm"
          value={toDatetimeLocalValue(element.targetDate)}
          onChange={(e) => onChange({ targetDate: fromDatetimeLocalValue(e.target.value) })}
        />
        <div className="form-text">Countdown runs until this date and time.</div>
      </div>
    </>
  )
}

function RsvpProperties({
  element,
  onChange,
  onEditForm,
}: {
  element: RsvpElement
  onChange: (patch: Partial<RsvpElement>) => void
  onEditForm: () => void
}) {
  const fieldCount = normalizeRsvpElement(element).fields.length
  return (
    <>
      <div className="mb-2">
        <label className="form-label small">Heading</label>
        <input
          className="form-control form-control-sm"
          value={element.heading}
          onChange={(e) => onChange({ heading: e.target.value })}
        />
      </div>
      <div className="mb-2">
        <label className="form-label small">Submit label</label>
        <input
          className="form-control form-control-sm"
          value={element.submitLabel}
          onChange={(e) => onChange({ submitLabel: e.target.value })}
        />
      </div>
      <div className="mb-3">
        <button type="button" className="btn btn-sm btn-outline-primary w-100" onClick={onEditForm}>
          <i className="bi bi-ui-checks me-1" aria-hidden="true" />
          Edit form ({fieldCount} field{fieldCount === 1 ? '' : 's'})
        </button>
      </div>
    </>
  )
}

function TransformEditor({
  transform,
  onChange,
}: {
  transform: CanvasElement['transform']
  onChange: (t: Partial<CanvasElement['transform']>) => void
}) {
  return (
    <div className="mb-3">
      <span className="form-label small d-block mb-1">Position & size</span>
      <div className="row g-1">
        {(['x', 'y', 'width', 'height', 'rotation', 'opacity'] as const).map((key) => (
          <div key={key} className="col-6">
            <label className="form-label small text-muted mb-0">{key}</label>
            <input
              type="number"
              className="form-control form-control-sm"
              value={transform[key]}
              step={key === 'opacity' ? 0.05 : 1}
              onChange={(e) => onChange({ [key]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
      <div className="form-check mt-2">
        <input
          id="el-locked"
          className="form-check-input"
          type="checkbox"
          checked={Boolean(transform.locked)}
          onChange={(e) => onChange({ locked: e.target.checked })}
        />
        <label className="form-check-label small" htmlFor="el-locked">Lock element</label>
      </div>
    </div>
  )
}

function TextProperties({
  element,
  onChange,
}: {
  element: TextElement
  onChange: (patch: Partial<TextElement>) => void
}) {
  const style = element.style
  const setStyle = (patch: Partial<TextElement['style']>) =>
    onChange({ style: { ...style, ...patch } })

  return (
    <>
      <div className="mb-2">
        <label className="form-label small">Content</label>
        <textarea
          className="form-control form-control-sm"
          rows={3}
          value={element.content}
          onChange={(e) => onChange({ content: e.target.value })}
        />
      </div>
      <div className="mb-2">
        <label className="form-label small">Font</label>
        <select
          className="form-select form-select-sm"
          value={style.fontFamily}
          onChange={(e) => setStyle({ fontFamily: e.target.value })}
        >
          {GOOGLE_FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="row g-1 mb-2">
        <div className="col-6">
          <label className="form-label small">Size</label>
          <input type="number" className="form-control form-control-sm" value={style.fontSize} onChange={(e) => setStyle({ fontSize: Number(e.target.value) })} />
        </div>
        <div className="col-6">
          <label className="form-label small">Color</label>
          <input type="color" className="form-control form-control-sm form-control-color" value={style.fill} onChange={(e) => setStyle({ fill: e.target.value })} />
        </div>
      </div>
      <div className="btn-group btn-group-sm mb-2 w-100">
        <button type="button" className={`btn btn-outline-secondary${style.fontWeight === 'bold' ? ' active' : ''}`} onClick={() => setStyle({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' })}><strong>B</strong></button>
        <button type="button" className={`btn btn-outline-secondary${style.fontStyle === 'italic' ? ' active' : ''}`} onClick={() => setStyle({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}><em>I</em></button>
        <button type="button" className={`btn btn-outline-secondary${style.underline ? ' active' : ''}`} onClick={() => setStyle({ underline: !style.underline })}><u>U</u></button>
      </div>
      <div className="mb-2">
        <label className="form-label small">Align</label>
        <select className="form-select form-select-sm" value={style.textAlign} onChange={(e) => setStyle({ textAlign: e.target.value as TextElement['style']['textAlign'] })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
          <option value="justify">Justify</option>
        </select>
      </div>
      <div className="mb-2">
        <label className="form-label small">Letter spacing</label>
        <input type="number" className="form-control form-control-sm" value={style.charSpacing} onChange={(e) => setStyle({ charSpacing: Number(e.target.value) })} />
      </div>
    </>
  )
}

function ImageProperties({
  element,
  onChange,
}: {
  element: ImageElement
  onChange: (patch: Partial<ImageElement>) => void
}) {
  return (
    <>
      <div className="mb-2">
        <label className="form-label small">Image URL</label>
        <input className="form-control form-control-sm" value={element.src} onChange={(e) => onChange({ src: e.target.value })} />
      </div>
      <div className="mb-2">
        <label className="form-label small">Fit</label>
        <select
          className="form-select form-select-sm"
          value={element.style.objectFit}
          onChange={(e) =>
            onChange({
              style: { ...element.style, objectFit: e.target.value as ImageElement['style']['objectFit'] },
            })
          }
        >
          <option value="contain">Show entire image</option>
          <option value="cover">Fill frame (may crop)</option>
          <option value="fill">Stretch to frame</option>
        </select>
      </div>
      <div className="mb-2">
        <label className="form-label small">Border radius</label>
        <input type="number" className="form-control form-control-sm" value={element.style.borderRadius} onChange={(e) => onChange({ style: { ...element.style, borderRadius: Number(e.target.value) } })} />
      </div>
      <div className="mb-2">
        <label className="form-label small">Opacity</label>
        <input type="range" min={0} max={1} step={0.05} value={element.transform.opacity} onChange={(e) => onChange({ transform: { ...element.transform, opacity: Number(e.target.value) } })} />
      </div>
    </>
  )
}

function VideoProperties({
  element,
  onChange,
}: {
  element: VideoElement
  onChange: (patch: Partial<VideoElement>) => void
}) {
  const v = element.video
  return (
    <>
      <div className="mb-2">
        <label className="form-label small">Provider</label>
        <select className="form-select form-select-sm" value={v.provider ?? 'youtube'} onChange={(e) => onChange({ video: { ...v, provider: e.target.value as VideoElement['video']['provider'] } })}>
          <option value="youtube">YouTube</option>
          <option value="vimeo">Vimeo</option>
          <option value="upload">Upload</option>
        </select>
      </div>
      <div className="mb-2">
        <label className="form-label small">Embed / video URL</label>
        <input className="form-control form-control-sm" value={v.embedUrl ?? v.src ?? ''} onChange={(e) => onChange({ video: { ...v, embedUrl: e.target.value } })} />
      </div>
      {(['autoplay', 'muted', 'loop'] as const).map((key) => (
        <div key={key} className="form-check">
          <input id={`vid-${key}`} className="form-check-input" type="checkbox" checked={v[key]} onChange={(e) => onChange({ video: { ...v, [key]: e.target.checked } })} />
          <label className="form-check-label small" htmlFor={`vid-${key}`}>{key}</label>
        </div>
      ))}
    </>
  )
}

function MapProperties({
  element,
  onChange,
}: {
  element: MapElement
  onChange: (patch: Partial<MapElement>) => void
}) {
  const m = element.map
  return (
    <>
      <div className="mb-2">
        <label className="form-label small">Venue</label>
        <input className="form-control form-control-sm" value={m.venueName} onChange={(e) => onChange({ map: { ...m, venueName: e.target.value } })} />
      </div>
      <div className="mb-2">
        <label className="form-label small">Address</label>
        <input className="form-control form-control-sm" value={m.address} onChange={(e) => onChange({ map: { ...m, address: e.target.value } })} />
      </div>
      <div className="mb-2">
        <label className="form-label small">Google Maps embed URL</label>
        <textarea className="form-control form-control-sm" rows={3} value={m.embedUrl} onChange={(e) => onChange({ map: { ...m, embedUrl: e.target.value } })} />
      </div>
    </>
  )
}

function BackgroundEditor({
  background,
  onChange,
}: {
  background: PageBackground
  onChange: (bg: PageBackground) => void
}) {
  return (
    <div>
      <p className="text-muted small">Page background (no selection)</p>
      <div className="mb-2">
        <label className="form-label small">Type</label>
        <select
          className="form-select form-select-sm"
          value={background.type}
          onChange={(e) => onChange({ ...background, type: e.target.value as PageBackground['type'] })}
        >
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
      </div>
      {background.type === 'solid' && (
        <div className="mb-2">
          <label className="form-label small">Color</label>
          <input type="color" className="form-control form-control-sm form-control-color" value={background.color ?? '#ffffff'} onChange={(e) => onChange({ ...background, color: e.target.value })} />
        </div>
      )}
      {background.type === 'image' && (
        <div className="mb-2">
          <label className="form-label small">Image URL</label>
          <input className="form-control form-control-sm" value={background.imageUrl ?? ''} onChange={(e) => onChange({ ...background, imageUrl: e.target.value })} />
        </div>
      )}
      {background.type === 'video' && (
        <div className="mb-2">
          <label className="form-label small">Video URL</label>
          <input className="form-control form-control-sm" value={background.videoUrl ?? ''} onChange={(e) => onChange({ ...background, videoUrl: e.target.value })} />
        </div>
      )}
      <div className="mb-2">
        <label className="form-label small">Overlay opacity</label>
        <input type="range" min={0} max={1} step={0.05} value={background.overlayOpacity ?? 0} onChange={(e) => onChange({ ...background, overlayOpacity: Number(e.target.value), overlayColor: background.overlayColor ?? '#000000' })} />
      </div>
      <div className="mb-2">
        <label className="form-label small">Blur</label>
        <input type="number" className="form-control form-control-sm" min={0} max={24} value={background.blur ?? 0} onChange={(e) => onChange({ ...background, blur: Number(e.target.value) })} />
      </div>
    </div>
  )
}

export default PropertiesPanel
