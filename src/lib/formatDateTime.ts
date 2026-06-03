import { getActiveAppTimeZone } from './appTimezone'

/** Format an ISO timestamp in a specific IANA timezone (e.g. company setting). */
export function formatDateTimeInTimeZone(
  iso: string | null | undefined,
  timeZone: string | undefined,
): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
  const tz = timeZone?.trim()
  if (!tz) return d.toLocaleString(undefined, opts)
  try {
    return d.toLocaleString(undefined, { ...opts, timeZone: tz })
  } catch {
    return d.toLocaleString(undefined, opts)
  }
}

/** Resolve IANA timezone for an email log row (API field or companies list). */
export function emailLogDisplayTimeZone(
  email: { company_id: number | null; company_timezone?: string },
  companies: { id: number; timezone: string }[],
): string | undefined {
  const fromApi = email.company_timezone?.trim()
  if (fromApi) return fromApi
  if (email.company_id == null) return undefined
  return companies.find((c) => c.id === email.company_id)?.timezone?.trim()
}

/** Format using the app-active company timezone, or an explicit override. */
export function formatAppDateTime(
  iso: string | null | undefined,
  timeZone?: string,
): string {
  return formatDateTimeInTimeZone(iso, timeZone ?? getActiveAppTimeZone())
}

export function formatAppDate(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const tz = (timeZone ?? getActiveAppTimeZone())?.trim()
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
  if (!tz) return d.toLocaleDateString(undefined, opts)
  try {
    return d.toLocaleDateString(undefined, { ...opts, timeZone: tz })
  } catch {
    return d.toLocaleDateString(undefined, opts)
  }
}
