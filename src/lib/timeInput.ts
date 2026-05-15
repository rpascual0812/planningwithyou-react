/** Normalize stored/API time strings for ``<input type="time">`` (HH:mm). */

export function storedValueToTimeInput(stored: string): string {
  const s = stored.trim()
  if (!s) return ''
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(s)
  if (!match) return s
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)))
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Value from time input → stored string (HH:mm). */
export function timeInputToStored(localVal: string): string {
  return localVal.trim()
}
