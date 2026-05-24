import type { EventInput } from '@fullcalendar/core'

import type { AppointmentFormState } from '../components/AppointmentEditModal'
import type { BookingItemRecord } from '../services/bookings'
import type { CalendarEventPayload, CalendarEventRecord, CalendarStatusRecord } from '../services/calendar'
import type { ContactRecord } from '../services/contacts'

export function formatLocalDateTime(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

export function isoToDatetimeLocalValue(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return formatLocalDateTime(d)
}

export function isoToDateLocalValue(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function datetimeLocalToIso(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toISOString()
}

export function dateLocalToIsoEndOfDay(value: string): string | null {
  if (!value) return null
  const d = new Date(`${value}T23:59:59`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function appointmentPayloadFromForm(form: AppointmentFormState): CalendarEventPayload {
  if (form.statusId == null) {
    throw new Error('Calendar status is required.')
  }
  return {
    title: form.title.trim() || 'Untitled',
    start: datetimeLocalToIso(form.startValue),
    end: datetimeLocalToIso(form.endValue),
    repeat_type: form.repeatType || null,
    repeat_end: dateLocalToIsoEndOfDay(form.repeatEndValue),
    status: form.statusId,
    contact: form.contactId,
    booking: form.bookingId,
  }
}

export function calendarRecordToEventInput(
  ev: CalendarEventRecord,
  statusById: Map<number, CalendarStatusRecord>,
  contactById?: Map<number, ContactRecord>,
  bookingById?: Map<number, BookingItemRecord>,
): EventInput {
  const status = statusById.get(ev.status)
  const contact = ev.contact != null ? contactById?.get(ev.contact) : undefined
  const booking = ev.booking != null ? bookingById?.get(ev.booking) : undefined
  return {
    id: String(ev.id),
    title: ev.title,
    start: ev.start,
    end: ev.end,
    allDay: false,
    backgroundColor: status?.background_color,
    borderColor: status?.background_color,
    textColor: status?.text_color,
    extendedProps: {
      statusTitle: status?.title ?? '',
      statusTextColor: status?.text_color,
      statusBackgroundColor: status?.background_color,
      contactFirstName: contact?.first_name ?? '',
      contactLastName: contact?.last_name ?? '',
      contactEmail: contact?.email ?? '',
      contactPhone: '',
      bookingTitle: booking?.title?.trim() ?? '',
      bookingUniqueId: booking?.unique_id ?? '',
      repeatType: ev.repeat_type ?? '',
      repeatEnd: ev.repeat_end ?? '',
    },
  }
}
