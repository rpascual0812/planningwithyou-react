import { type SubmitEvent } from 'react'

import { contactDisplayName } from '../lib/contactDisplay'
import {
  REPEAT_TYPE_OPTIONS,
  type CalendarStatusRecord,
  type RepeatTypeValue,
} from '../services/calendar'
import type { BookingItemRecord } from '../services/bookings'
import type { ContactRecord } from '../services/contacts'

export type AppointmentFormState = {
  eventId: number | null
  title: string
  location: string
  startValue: string
  endValue: string
  repeatType: RepeatTypeValue
  repeatEndValue: string
  contactId: number | null
  statusId: number | null
  bookingId: number | null
}

export const EMPTY_APPOINTMENT_FORM: AppointmentFormState = {
  eventId: null,
  title: '',
  location: '',
  startValue: '',
  endValue: '',
  repeatType: '',
  repeatEndValue: '',
  contactId: null,
  statusId: null,
  bookingId: null,
}

type AppointmentEditModalProps = {
  form: AppointmentFormState
  contacts: ContactRecord[]
  statuses: CalendarStatusRecord[]
  bookings: BookingItemRecord[]
  loadingOptions?: boolean
  saving?: boolean
  error?: string | null
  onChange: (next: AppointmentFormState) => void
  onClose: () => void
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void
  onDelete?: () => void
  deleting?: boolean
  canWrite?: boolean
}

function bookingLabel(booking: BookingItemRecord): string {
  const title = booking.title?.trim() || 'Untitled'
  return `${booking.unique_id} — ${title}`
}

const AppointmentEditModal = ({
  form,
  contacts,
  statuses,
  bookings,
  loadingOptions = false,
  saving = false,
  error = null,
  onChange,
  onClose,
  onSubmit,
  onDelete,
  deleting = false,
  canWrite = true,
}: AppointmentEditModalProps) => {
  const isEdit = form.eventId !== null
  const viewOnly = !canWrite
  const showRepeatEnd = form.repeatType !== ''

  return (
    <>
      <div
        className="appointment-edit-modal-backdrop modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="appointment-edit-modal modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointmentEditModalTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <form onSubmit={onSubmit}>
              <div className="modal-header">
                <h1 id="appointmentEditModalTitle" className="modal-title fs-5">
                  {isEdit
                    ? viewOnly
                      ? 'View appointment'
                      : 'Edit appointment'
                    : 'Add appointment'}
                </h1>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                  disabled={saving || deleting}
                />
              </div>
              <div className="modal-body">
                {loadingOptions && (
                  <p className="text-muted small mb-3">Loading form options…</p>
                )}

                <fieldset
                  disabled={viewOnly}
                  className="border-0 m-0 p-0 min-w-0"
                >
                <div className="mb-3">
                  <label htmlFor="appointment-title" className="form-label">
                    Title
                  </label>
                  <input
                    id="appointment-title"
                    type="text"
                    className="form-control"
                    value={form.title}
                    onChange={(e) => onChange({ ...form, title: e.target.value })}
                    required
                    autoFocus
                    disabled={saving || deleting}
                  />
                </div>

                

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label htmlFor="appointment-start" className="form-label">
                      Start date and time
                    </label>
                    <input
                      id="appointment-start"
                      type="datetime-local"
                      className="form-control"
                      value={form.startValue}
                      onChange={(e) =>
                        onChange({ ...form, startValue: e.target.value })
                      }
                      required
                      disabled={saving || deleting}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="appointment-end" className="form-label">
                      End date and time
                    </label>
                    <input
                      id="appointment-end"
                      type="datetime-local"
                      className="form-control"
                      value={form.endValue}
                      onChange={(e) => onChange({ ...form, endValue: e.target.value })}
                      required
                      disabled={saving || deleting}
                    />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className={showRepeatEnd ? 'col-md-6' : 'col-12'}>
                    <label htmlFor="appointment-repeat" className="form-label">
                      Repeat
                    </label>
                    <select
                      id="appointment-repeat"
                      className="form-select"
                      value={form.repeatType}
                      onChange={(e) => {
                        const repeatType = e.target.value as RepeatTypeValue
                        onChange({
                          ...form,
                          repeatType,
                          repeatEndValue:
                            repeatType === '' ? '' : form.repeatEndValue,
                        })
                      }}
                      disabled={saving || deleting || loadingOptions}
                    >
                      {REPEAT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value || 'none'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {showRepeatEnd && (
                    <div className="col-md-6">
                      <label htmlFor="appointment-repeat-end" className="form-label">
                        Repeat end date
                      </label>
                      <input
                        id="appointment-repeat-end"
                        type="date"
                        className="form-control"
                        value={form.repeatEndValue}
                        onChange={(e) =>
                          onChange({ ...form, repeatEndValue: e.target.value })
                        }
                        disabled={saving || deleting}
                      />
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="appointment-contact" className="form-label">
                    Contact
                  </label>
                  <select
                    id="appointment-contact"
                    className="form-select"
                    value={form.contactId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      onChange({
                        ...form,
                        contactId: v === '' ? null : Number(v),
                      })
                    }}
                    disabled={saving || deleting || loadingOptions}
                  >
                    <option value="">No contact</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {contactDisplayName(c)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label htmlFor="appointment-status" className="form-label">
                    Calendar status
                  </label>
                  <select
                    id="appointment-status"
                    className="form-select"
                    value={form.statusId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      onChange({
                        ...form,
                        statusId: v === '' ? null : Number(v),
                      })
                    }}
                    required
                    disabled={saving || deleting || loadingOptions}
                  >
                    <option value="" disabled>
                      Select a status
                    </option>
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label htmlFor="appointment-location" className="form-label">
                    Location
                  </label>
                  <textarea
                    id="appointment-location"
                    className="form-control"
                    rows={2}
                    value={form.location}
                    onChange={(e) => onChange({ ...form, location: e.target.value })}
                    placeholder="Enter appointment location"
                    disabled={saving || deleting}
                  />
                </div>

                <div className="mb-0">
                  <label htmlFor="appointment-booking" className="form-label">
                    Booking
                  </label>
                  <select
                    id="appointment-booking"
                    className="form-select"
                    value={form.bookingId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      onChange({
                        ...form,
                        bookingId: v === '' ? null : Number(v),
                      })
                    }}
                    disabled={saving || deleting || loadingOptions}
                  >
                    <option value="">No booking</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {bookingLabel(b)}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                    {error}
                  </div>
                )}
                </fieldset>
              </div>
              <div className="modal-footer justify-content-between">
                <div>
                  {isEdit && onDelete && (
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={onDelete}
                      disabled={saving || deleting}
                    >
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                    disabled={saving || deleting}
                  >
                    {viewOnly ? 'Close' : 'Cancel'}
                  </button>
                  {canWrite && (
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving || deleting || loadingOptions}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

export default AppointmentEditModal
