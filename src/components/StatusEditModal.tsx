import type { SubmitEvent } from 'react'

export type StatusFormState = {
  mode: 'create' | 'edit'
  id: number | null
  title: string
  description: string
  color: string
}

export const COLOR_SWATCHES = [
  '#1f3a5f',
  '#52b585',
  '#f0a830',
  '#5a8edb',
  '#d65a5a',
  '#9c6cd0',
  '#3a9870',
  '#152741',
]

type StatusEditModalProps = {
  form: StatusFormState
  onChange: (next: StatusFormState) => void
  onClose: () => void
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void
}

const StatusEditModal = ({
  form,
  onChange,
  onClose,
  onSubmit,
}: StatusEditModalProps) => {
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
        aria-labelledby="statusEditTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={onSubmit}>
              <div className="modal-header">
                <h1 id="statusEditTitle" className="modal-title fs-5">
                  {form.mode === 'create' ? 'New status' : 'Edit status'}
                </h1>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label htmlFor="status-title" className="form-label">
                    Title
                  </label>
                  <input
                    id="status-title"
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
                  <label htmlFor="status-description" className="form-label">
                    Description
                  </label>
                  <textarea
                    id="status-description"
                    className="form-control"
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      onChange({ ...form, description: e.target.value })
                    }
                    placeholder="What does this status represent?"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label d-block">Color</label>
                  <div className="kanban-color-swatches" role="radiogroup">
                    {COLOR_SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={form.color === c}
                        aria-label={`Color ${c}`}
                        className={`kanban-color-swatch${
                          form.color === c ? ' is-selected' : ''
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => onChange({ ...form, color: c })}
                      />
                    ))}
                    <input
                      type="color"
                      className="kanban-color-input"
                      value={form.color}
                      onChange={(e) =>
                        onChange({ ...form, color: e.target.value })
                      }
                      aria-label="Custom color"
                      title="Custom color"
                    />
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

export default StatusEditModal
