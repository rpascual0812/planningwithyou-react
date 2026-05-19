import type { BookingFormState } from '../components/BookingEditModal'
import {
  EMPTY_APPOINTMENT_FORM,
  type AppointmentFormState,
} from '../components/AppointmentEditModal'
import { formatLocalDateTime } from './calendarEventFormat'

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

/** Local datetime from booking ``dateOfEvent`` / ``timeOfEvent`` (API ``date_or_event``). */
export function bookingDateOrEventToDate(form: BookingFormState): Date | null {
  if (!form.dateOfEvent.trim()) return null
  const local = form.timeOfEvent.trim()
    ? `${form.dateOfEvent}T${form.timeOfEvent}`
    : `${form.dateOfEvent}T00:00`
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d
}

export function appointmentFormFromBooking(
  form: BookingFormState,
  defaultStatusId: number | null,
): AppointmentFormState | null {
  const start = bookingDateOrEventToDate(form)
  if (!start) return null
  const end = new Date(start.getTime() + FOUR_HOURS_MS)
  return {
    ...EMPTY_APPOINTMENT_FORM,
    title: form.title.trim() || 'Untitled',
    startValue: formatLocalDateTime(start),
    endValue: formatLocalDateTime(end),
    contactId: form.contactId,
    bookingId: form.id,
    statusId: defaultStatusId,
  }
}
