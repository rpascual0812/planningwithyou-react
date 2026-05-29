/** Normalize YouTube/Vimeo URLs to iframe embed URLs. */
export function toVideoEmbedUrl(raw: string, provider?: string): string {
  const url = raw.trim()
  if (!url) return ''
  if (url.includes('/embed/')) return url

  if (provider === 'vimeo' || url.includes('vimeo.com')) {
    const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1]
    return id ? `https://player.vimeo.com/video/${id}` : url
  }

  const ytMatch =
    url.match(/[?&]v=([^&]+)/)?.[1] ??
    url.match(/youtu\.be\/([^?]+)/)?.[1] ??
    url.match(/youtube\.com\/embed\/([^?]+)/)?.[1]
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch}`

  return url
}

export function videoIframeSrc(
  embedUrl: string,
  opts: { autoplay?: boolean; muted?: boolean; loop?: boolean },
): string {
  if (!embedUrl) return ''
  try {
    const u = new URL(embedUrl)
    if (opts.autoplay) u.searchParams.set('autoplay', '1')
    if (opts.muted) u.searchParams.set('mute', '1')
    if (opts.loop) u.searchParams.set('loop', '1')
    return u.toString()
  } catch {
    return embedUrl
  }
}
