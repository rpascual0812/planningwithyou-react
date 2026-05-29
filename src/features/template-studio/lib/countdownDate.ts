/** Default countdown target: same date/time one year from now. */
export function defaultCountdownTargetDate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
}

/** Format ISO date for `<input type="datetime-local">` in the user's timezone. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse datetime-local input value to ISO string. */
export function fromDatetimeLocalValue(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return defaultCountdownTargetDate()
  return d.toISOString()
}

export type CountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

export function getCountdownParts(targetDate: string, now = Date.now()): CountdownParts {
  const target = new Date(targetDate).getTime()
  if (Number.isNaN(target)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  }
  const diff = Math.max(0, target - now)
  const expired = target <= now
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    expired,
  }
}

export function formatCountdownCompact(parts: CountdownParts): string {
  if (parts.expired) return '0d 0h 0m 0s'
  return `${parts.days}d ${parts.hours}h ${parts.minutes}m ${parts.seconds}s`
}
