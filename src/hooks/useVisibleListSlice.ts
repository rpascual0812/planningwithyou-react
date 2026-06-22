import { useCallback, useEffect, useMemo, useState } from 'react'

export const PANEL_LIST_INITIAL_SIZE = 5
export const PANEL_LIST_SHOW_MORE_SIZE = 5

export function useVisibleListSlice<T>(
  items: readonly T[],
  resetDeps: ReadonlyArray<unknown> = [],
) {
  const [visibleCount, setVisibleCount] = useState(PANEL_LIST_INITIAL_SIZE)

  useEffect(() => {
    setVisibleCount(PANEL_LIST_INITIAL_SIZE)
  }, [items.length, ...resetDeps])

  const visible = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  )

  const hiddenCount = Math.max(0, items.length - visibleCount)

  const showMore = useCallback(() => {
    setVisibleCount((current) =>
      Math.min(current + PANEL_LIST_SHOW_MORE_SIZE, items.length),
    )
  }, [items.length])

  return { visible, hiddenCount, showMore }
}
