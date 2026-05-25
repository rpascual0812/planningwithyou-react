const DEFAULT_MAX_WIDTH = 200
const DEFAULT_SQUARE_SIZE = 200
const JPEG_QUALITY = 0.92

/**
 * Scale an image file to a maximum width; height follows aspect ratio.
 * Returns the original file when already within bounds and format is unchanged.
 */
export async function resizeImageFileToMaxWidth(
  file: File,
  maxWidth = DEFAULT_MAX_WIDTH,
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const usePng = file.type === 'image/png'
    const mimeType = usePng ? 'image/png' : 'image/jpeg'

    if (scale === 1 && file.type === mimeType) {
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Could not process image.')
    }
    if (usePng) {
      ctx.clearRect(0, 0, width, height)
    }
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('Could not resize image.')),
        mimeType,
        usePng ? undefined : JPEG_QUALITY,
      )
    })

    const ext = usePng ? 'png' : 'jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], `${baseName}.${ext}`, { type: mimeType, lastModified: Date.now() })
  } finally {
    bitmap.close()
  }
}

/**
 * Center-crop and scale an image to a square (e.g. 200×200 profile photo).
 */
export async function resizeImageFileToSquare(
  file: File,
  size = DEFAULT_SQUARE_SIZE,
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const cropSize = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - cropSize) / 2
    const sy = (bitmap.height - cropSize) / 2

    const usePng = file.type === 'image/png'
    const mimeType = usePng ? 'image/png' : 'image/jpeg'

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Could not process image.')
    }
    if (usePng) {
      ctx.clearRect(0, 0, size, size)
    }
    ctx.drawImage(bitmap, sx, sy, cropSize, cropSize, 0, 0, size, size)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('Could not resize image.')),
        mimeType,
        usePng ? undefined : JPEG_QUALITY,
      )
    })

    const ext = usePng ? 'png' : 'jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${baseName}.${ext}`, { type: mimeType, lastModified: Date.now() })
  } finally {
    bitmap.close()
  }
}
