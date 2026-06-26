import { apiFetch, authHeaders, buildApiUrl } from './api'

const BASE = '/scheduled-reminder-emails/'

export type ScheduledReminderStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'cancelled'

export type ScheduledReminderRecord = {
  id: number
  company_id: number
  calendar_event_id: number
  event_title: string
  event_start: string
  event_end: string
  appointment_reminder: number | null
  reminder_frequency: number | null
  reminder_unit: string | null
  reminder_calendar: 'start' | 'end' | null
  recipient_role: 'contact' | 'author'
  recipient_email: string
  recipient_name: string
  send_at: string
  status: ScheduledReminderStatus
  email_log_id: number | null
  error: string
  sent_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ScheduledRemindersPage = {
  count: number
  next: string | null
  previous: string | null
  results: ScheduledReminderRecord[]
}

function querySuffix(
  page: number,
  options: {
    companyId?: number | null
    search?: string
    status?: string
    timing?: string
    includeDeleted?: boolean
  },
): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('paginated', 'true')
  if (options.companyId != null) {
    params.set('company_id', String(options.companyId))
  }
  if (options.search) params.set('search', options.search)
  if (options.status) params.set('status', options.status)
  if (options.timing) params.set('timing', options.timing)
  if (options.includeDeleted) params.set('include_deleted', 'true')
  return `?${params.toString()}`
}

export async function fetchScheduledRemindersPage(
  page = 1,
  options: {
    companyId?: number | null
    search?: string
    status?: string
    timing?: string
    includeDeleted?: boolean
  } = {},
): Promise<ScheduledRemindersPage> {
  const qs = querySuffix(page, options)
  const res = await apiFetch(buildApiUrl(`${BASE}${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load scheduled reminders')
  return res.json()
}

export async function cancelScheduledReminder(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to cancel reminder')
  }
}

export async function restoreScheduledReminder(
  id: number,
): Promise<ScheduledReminderRecord> {
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/restore/`), {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to restore reminder')
  }
  return res.json()
}

export function formatScheduledReminderOffset(
  row: Pick<
    ScheduledReminderRecord,
    'reminder_frequency' | 'reminder_unit' | 'reminder_calendar'
  >,
): string {
  if (row.reminder_frequency == null || !row.reminder_unit) return '—'
  const unit = row.reminder_unit.replace(/s$/, '')
  const plural = row.reminder_frequency === 1 ? unit : `${unit}s`
  const anchor =
    row.reminder_calendar === 'end' ? 'before event end' : 'before event start'
  return `${row.reminder_frequency} ${plural} ${anchor}`
}

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  if (typeof obj.detail === 'string') return obj.detail
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  }
  return ''
}
