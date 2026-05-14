import type { FormEvent } from 'react'

export type BookingFormState = {
  mode: 'create' | 'edit'
  id: number | null
  columnId: number
  title: string
  notes: string
}

export type BookingStatus = {
  id: number
  title: string
}

type BookingEditModalProps = {
  form: BookingFormState
  statuses: BookingStatus[]
  onChange: (next: BookingFormState) => void
  onClose: () => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

const BookingEditModal = ({
  form,
  statuses,
  onChange,
  onClose,
  onSubmit,
}: BookingEditModalProps) => {
  return (
    <>
      <div
        className="booking-edit-modal-backdrop modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="booking-edit-modal modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookingEditTitle"
      >
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={onSubmit}>
              <div className="modal-header">
                <h1 id="bookingEditTitle" className="modal-title fs-5">
                  {form.mode === 'create' ? 'New booking' : 'Edit booking'}
                </h1>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                />
              </div>
              <div className="modal-body">
                <div className="row g-3 mb-3">
                  <div className="col-md-9">
                    <div className="mb-3">
                    <div className="mb-3">
                  <label htmlFor="booking-title" className="form-label">
                    Title
                  </label>
                  <input
                    id="booking-title"
                    type="text"
                    className="form-control"
                    value={form.title}
                    onChange={(e) =>
                      onChange({ ...form, title: e.target.value })
                    }
                    required
                    autoFocus
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="booking-notes" className="form-label">
                    Notes
                  </label>
                  <textarea
                    id="booking-notes"
                    className="form-control"
                    rows={3}
                    value={form.notes}
                    onChange={(e) =>
                      onChange({ ...form, notes: e.target.value })
                    }
                  />
                </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="mb-3">
                    <div className="mb-0">
                  <label htmlFor="booking-status" className="form-label">
                    Status
                  </label>
                  <select
                    id="booking-status"
                    className="form-select"
                    value={form.columnId}
                    onChange={(e) =>
                      onChange({ ...form, columnId: Number(e.target.value) })
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
                    </div>
                  </div>
                </div>
                
                
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

export default BookingEditModal
