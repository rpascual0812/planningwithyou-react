import type { ImageElement } from '../types/schema'

export function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/** Box size that preserves aspect ratio within max bounds. */
export function fitBoxToAspect(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: maxWidth, height: maxHeight }
  }
  const ratio = naturalWidth / naturalHeight
  let width = maxWidth
  let height = width / ratio
  if (height > maxHeight) {
    height = maxHeight
    width = height * ratio
  }
  return {
    width: Math.round(width),
    height: Math.round(height),
  }
}

export async function createImageElementFromSrc(
  src: string,
  create: (url?: string) => ImageElement,
  assetUuid?: string,
): Promise<ImageElement> {
  const el = create(src)
  if (assetUuid) {
    el.assetUuid = assetUuid
  }
  el.style.objectFit = 'contain'
  try {
    const { width: nw, height: nh } = await loadImageDimensions(src)
    const box = fitBoxToAspect(nw, nh, el.transform.width, el.transform.height)
    el.transform = { ...el.transform, width: box.width, height: box.height }
  } catch {
    // Keep default box if dimensions cannot be read (e.g. broken URL).
  }
  return el
}

export async function createImageElementFromFile(
  file: File,
  create: (url?: string) => ImageElement,
  upload: (file: File) => Promise<{ url: string; uuid: string }>,
): Promise<ImageElement> {
  const { url, uuid } = await upload(file)
  return createImageElementFromSrc(url, create, uuid)
}
