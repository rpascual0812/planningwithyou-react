import { useEffect, useRef, useState, type RefObject } from 'react'

const DEFAULT_OPTIONS: IntersectionObserverInit = {
  threshold: 0.12,
  rootMargin: '0px 0px -4% 0px',
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Returns true once `ref` intersects the viewport (or immediately when animations
 * are disabled / reduced motion is preferred).
 */
export function useEntranceInView(enabled: boolean): { ref: RefObject<HTMLDivElement | null>; inView: boolean } {
  const ref = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(() => !enabled || prefersReducedMotion())

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setInView(true)
      return
    }

    const node = ref.current
    if (!node) return

    setInView(false)

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      }
    }, DEFAULT_OPTIONS)

    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled])

  return { ref, inView }
}
