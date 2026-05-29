import type { RefObject } from 'react'
import { usePageScale, type PageScaleResult } from './usePageScale'

type PreviewMode = 'desktop' | 'mobile'

export type EditorPageScale = Pick<PageScaleResult, 'scale' | 'ready'> & {
  pageScale: number
}

/** Editor page scale (container width → design pixels), before zoom. */
export function useEditorPageScale(
  designWidth: number,
  containerRef: RefObject<HTMLElement | null>,
  previewMode: PreviewMode,
): EditorPageScale {
  const { pageScale, scale, ready } = usePageScale(designWidth, containerRef, { previewMode })
  return { pageScale, scale, ready }
}
