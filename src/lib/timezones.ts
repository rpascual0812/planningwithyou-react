/** IANA time zones supported by the runtime (sorted). */
export const TIMEZONE_OPTIONS = [...Intl.supportedValuesOf('timeZone')].sort()

/** Match typed value to a known zone (exact or case-insensitive). */
export function resolveTimezoneInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (TIMEZONE_OPTIONS.includes(trimmed)) return trimmed
  const match = TIMEZONE_OPTIONS.find(
    (tz) => tz.toLowerCase() === trimmed.toLowerCase(),
  )
  return match ?? trimmed
}

export function isKnownTimezone(value: string): boolean {
  const trimmed = value.trim()
  return !trimmed || TIMEZONE_OPTIONS.includes(trimmed)
}
