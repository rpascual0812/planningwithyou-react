import CountdownDisplay from '../components/countdown/CountdownDisplay'
import { designPixelStyle, designTextStyle } from '../lib/pageLayout'
import type { CanvasElement, RsvpElement } from '../types/schema'
import RsvpLiveForm from '../components/rsvp/RsvpLiveForm'
import { toVideoEmbedUrl, videoIframeSrc } from '../lib/videoEmbed'

type RenderedElementProps = {
  element: CanvasElement
  pageScale: number
  invitationSlug?: string
}

/** DOM rendering for one canvas element (shared contract with Fabric editor geometry). */
const RenderedElement = ({ element: el, pageScale, invitationSlug }: RenderedElementProps) => {
  if (el.type === 'text') {
    return (
      <div
        style={{
          ...designTextStyle(el.transform, pageScale),
          fontFamily: el.style.fontFamily,
          fontSize: el.style.fontSize * pageScale,
          color: el.style.fill,
          fontWeight: el.style.fontWeight,
          fontStyle: el.style.fontStyle,
          textDecoration: el.style.underline ? 'underline' : undefined,
          letterSpacing: el.style.charSpacing * pageScale,
          textAlign: el.style.textAlign,
          lineHeight: el.style.lineHeight,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          animationDelay: el.animation?.delayMs ? `${el.animation.delayMs}ms` : undefined,
          animationDuration: el.animation?.durationMs ? `${el.animation.durationMs}ms` : undefined,
        }}
        className={`invitation-el invitation-el--text${el.animation?.entrance && el.animation.entrance !== 'none' ? ` inv-animate-${el.animation.entrance}` : ''}`}
      >
        {el.content}
      </div>
    )
  }

  const style = designPixelStyle(el.transform, pageScale)

  if (el.type === 'image') {
    if (!el.src) {
      return (
        <div
          style={{ ...style, background: '#f0ebe3' }}
          className="invitation-el invitation-el--image"
          aria-hidden
        />
      )
    }
    return (
      <img
        src={el.src}
        alt={el.alt}
        style={{
          ...style,
          objectFit: el.style.objectFit,
          objectPosition: 'center',
          borderRadius: el.style.borderRadius * pageScale,
          boxShadow: el.style.shadowBlur
            ? `0 ${4 * pageScale}px ${el.style.shadowBlur * pageScale}px ${el.style.shadowColor}`
            : undefined,
        }}
        className="invitation-el invitation-el--image"
      />
    )
  }

  if (el.type === 'shape') {
    const r =
      el.shape === 'circle'
        ? (Math.min(el.transform.width, el.transform.height) / 2) * pageScale
        : 0
    return (
      <div
        style={{
          ...style,
          backgroundColor: el.fill,
          border: el.stroke ? `${el.strokeWidth * pageScale}px solid ${el.stroke}` : undefined,
          borderRadius: r,
        }}
        className="invitation-el invitation-el--shape"
        aria-hidden
      />
    )
  }

  if (el.type === 'video') {
    const src = videoIframeSrc(
      toVideoEmbedUrl(el.video.embedUrl ?? el.video.src ?? '', el.video.provider),
      el.video,
    )
    return src ? (
      <iframe
        title={el.name}
        src={src}
        style={{ ...style, overflow: 'hidden' }}
        className="invitation-el invitation-el--video border-0"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      />
    ) : null
  }

  if (el.type === 'map') {
    return el.map.embedUrl ? (
      <iframe
        title={el.map.venueName}
        src={el.map.embedUrl}
        style={{ ...style, overflow: 'hidden' }}
        className="invitation-el invitation-el--map border-0"
        loading="lazy"
      />
    ) : (
      <div style={style} className="invitation-el invitation-el--map p-2 bg-light border">
        <strong>{el.map.venueName}</strong>
        <div className="small text-muted">{el.map.address}</div>
      </div>
    )
  }

  if (el.type === 'countdown') {
    return (
      <div style={style} className="invitation-el invitation-el--countdown">
        <CountdownDisplay
          targetDate={el.targetDate}
          label={el.label}
          style={el.style}
          pageScale={pageScale}
        />
      </div>
    )
  }

  if (el.type === 'rsvp') {
    if (invitationSlug) {
      return (
        <RsvpLiveForm
          element={el as RsvpElement}
          invitationSlug={invitationSlug}
          style={style}
          pageScale={pageScale}
        />
      )
    }
    return (
      <div style={style} className="invitation-el invitation-el--rsvp p-3 bg-white rounded shadow-sm">
        <p className="small text-muted mb-0">RSVP form (publish to enable submissions)</p>
      </div>
    )
  }

  if (el.type === 'gallery') {
    return (
      <div
        style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: `repeat(${el.columns}, 1fr)`,
          gap: 8 * pageScale,
          overflow: 'hidden',
        }}
        className="invitation-el invitation-el--gallery"
      >
        {el.images.map((img, i) => (
          <img key={i} src={img.src} alt={img.alt} className="w-100 rounded object-fit-cover" />
        ))}
      </div>
    )
  }

  if (el.type === 'music' && el.audioUrl) {
    return (
      <audio style={style} className="invitation-el" controls autoPlay={el.autoplay}>
        <source src={el.audioUrl} />
      </audio>
    )
  }

  return null
}

export default RenderedElement
