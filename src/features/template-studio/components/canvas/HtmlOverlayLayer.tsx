import { useMemo, type CSSProperties } from 'react'
import { designPixelStyle } from '../../lib/pageLayout'
import { normalizeRsvpElement } from '../../lib/rsvpFields'
import CountdownDisplay from '../countdown/CountdownDisplay'
import { isElementVisibleOnPage } from '../../lib/pageBounds'
import type { CanvasElement, RsvpElement } from '../../types/schema'
import RsvpFormFields from '../rsvp/RsvpFormFields'
import { toVideoEmbedUrl, videoIframeSrc } from '../../lib/videoEmbed'

const OVERLAY_TYPES = new Set([
  'video',
  'map',
  'rsvp',
  'gallery',
  'countdown',
  'music',
])

type HtmlOverlayLayerProps = {
  elements: CanvasElement[]
  selectedIds: string[]
  pageWidth: number
  pageHeight: number
  displayScale: number
  visible?: boolean
}

const HtmlOverlayLayer = ({
  elements,
  selectedIds,
  pageWidth,
  pageHeight,
  displayScale,
  visible = true,
}: HtmlOverlayLayerProps) => {
  const overlayEls = useMemo(
    () =>
      elements.filter(
        (el) => OVERLAY_TYPES.has(el.type) && isElementVisibleOnPage(el.transform, pageWidth, pageHeight),
      ),
    [elements, pageWidth, pageHeight],
  )

  if (!overlayEls.length) return null

  return (
    <div
      className="ts-html-overlays"
      aria-hidden={!visible}
      style={{ visibility: visible ? 'visible' : 'hidden' }}
    >
      {overlayEls.map((el) => {
        const selected = selectedIds.includes(el.id)
        const style: CSSProperties = {
          ...designPixelStyle(el.transform, displayScale),
          zIndex: el.transform.zIndex + 10,
          pointerEvents: 'none',
          outline: selected ? '2px solid #0d6efd' : undefined,
        }
        return (
          <div key={el.id} className="ts-html-overlay" style={style}>
            {el.type === 'video' && (
              <iframe
                title={el.name}
                src={videoIframeSrc(
                  toVideoEmbedUrl(el.video.embedUrl ?? el.video.src ?? '', el.video.provider),
                  el.video,
                )}
                className="w-100 h-100 border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            )}
            {el.type === 'map' && (
              <div className="h-100 d-flex flex-column bg-light">
                {el.map.embedUrl ? (
                  <iframe
                    title={el.map.venueName}
                    src={el.map.embedUrl}
                    className="flex-grow-1 border-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted small p-2 text-center">
                    {el.map.venueName || 'Map embed URL'}
                  </div>
                )}
              </div>
            )}
            {el.type === 'countdown' && (
              <CountdownDisplay
                targetDate={el.targetDate}
                label={el.label}
                style={el.style}
                pageScale={displayScale}
              />
            )}
            {el.type === 'rsvp' && (
              <RsvpPreview element={el as RsvpElement} pageScale={displayScale} />
            )}
            {el.type === 'gallery' && (
              <div
                className="h-100 p-1"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${el.columns}, 1fr)`,
                  gap: 8 * displayScale,
                }}
              >
                {(el.images.length ? el.images : [{ src: '', alt: 'Photo' }]).map((img, i) => (
                  <div
                    key={i}
                    className="bg-secondary bg-opacity-25 rounded"
                    style={{
                      minHeight: 40,
                      backgroundImage: img.src ? `url(${img.src})` : undefined,
                      backgroundSize: 'cover',
                    }}
                  />
                ))}
              </div>
            )}
            {el.type === 'music' && (
              <div className="h-100 d-flex align-items-center justify-content-center bg-dark text-white rounded-pill px-2 small">
                <i className="bi bi-music-note-beamed me-1" />
                {el.title || 'Music'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RsvpPreview({ element, pageScale }: { element: RsvpElement; pageScale: number }) {
  const rsvp = normalizeRsvpElement(element)
  return (
    <div className="h-100 p-2 bg-white border rounded small overflow-auto">
      <strong style={{ fontSize: 14 * pageScale }}>{rsvp.heading}</strong>
      <div className="mt-2">
        <RsvpFormFields element={rsvp} disabled readOnly />
        <button type="button" className="btn btn-sm btn-primary w-100 mt-1" disabled>
          {rsvp.submitLabel}
        </button>
      </div>
    </div>
  )
}

export default HtmlOverlayLayer
