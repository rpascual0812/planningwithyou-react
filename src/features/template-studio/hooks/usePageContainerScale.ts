import type { RefObject } from 'react'
import { usePageScale } from './usePageScale'

/** Live/public page scale — same formula as editor at zoom 1. */
export function usePageContainerScale(
  designWidth: number,
  containerRef: RefObject<HTMLElement | null>,
): { scale: number; ready: boolean } {
  const { scale, ready } = usePageScale(designWidth, containerRef)
  return { scale, ready }
}
