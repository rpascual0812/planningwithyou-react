import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  cloneRsvpFields,
  createRsvpField,
  normalizeRsvpElement,
  parseExpectedGuestCountInput,
  RSVP_FIELD_TYPES,
  toRsvpDeadlineInputValue,
} from '../../lib/rsvpFields'
import type { RsvpElement, RsvpField } from '../../types/schema'

type RsvpFormSavePatch = Pick<
  RsvpElement,
  | 'heading'
  | 'submitLabel'
  | 'successMessage'
  | 'fields'
  | 'expectedGuestCount'
  | 'rsvpDeadline'
>

type RsvpFormEditorModalProps = {
  open: boolean
  element: RsvpElement | null
  onSave: (patch: RsvpFormSavePatch) => void
  onClose: () => void
}

const RsvpFormEditorModal = ({ open, element, onSave, onClose }: RsvpFormEditorModalProps) => {
  const [heading, setHeading] = useState('')
  const [submitLabel, setSubmitLabel] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [expectedGuestCount, setExpectedGuestCount] = useState('')
  const [rsvpDeadline, setRsvpDeadline] = useState('')
  const [fields, setFields] = useState<RsvpField[]>([])

  useEffect(() => {
    if (!open || !element) return
    const rsvp = normalizeRsvpElement(element)
    setHeading(rsvp.heading)
    setSubmitLabel(rsvp.submitLabel)
    setSuccessMessage(rsvp.successMessage ?? 'Thank you! Your RSVP has been received.')
    setExpectedGuestCount(
      rsvp.expectedGuestCount != null && rsvp.expectedGuestCount > 0
        ? String(rsvp.expectedGuestCount)
        : '',
    )
    setRsvpDeadline(toRsvpDeadlineInputValue(rsvp.rsvpDeadline))
    setFields(cloneRsvpFields(rsvp.fields))
  }, [open, element?.id])

  const updateField = (id: string, patch: Partial<RsvpField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
  }

  const addField = () => {
    setFields((prev) => [
      ...prev,
      createRsvpField({ label: 'New field', type: 'text', required: false }),
    ])
  }

  const handleSave = () => {
    const parsedExpected = parseExpectedGuestCountInput(expectedGuestCount)
    const trimmedDeadline = rsvpDeadline.trim()

    onSave({
      heading: heading.trim() || 'Please RSVP',
      submitLabel: submitLabel.trim() || 'Submit',
      successMessage: successMessage.trim() || 'Thank you! Your RSVP has been received.',
      fields,
      expectedGuestCount: parsedExpected,
      rsvpDeadline: trimmedDeadline || undefined,
    })
    onClose()
  }

  if (!open || !element) return null

  return createPortal(
    <>
      <div className="modal fade show d-block ts-modal ts-rsvp-modal" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">RSVP form</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small">Heading</label>
                  <input
                    className="form-control form-control-sm"
                    value={heading}
                    onChange={(e) => setHeading(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small">Submit button label</label>
                  <input
                    className="form-control form-control-sm"
                    value={submitLabel}
                    onChange={(e) => setSubmitLabel(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small">Success message</label>
                  <input
                    className="form-control form-control-sm"
                    value={successMessage}
                    onChange={(e) => setSuccessMessage(e.target.value)}
                  />
                </div>
              </div>

              <div className="border rounded-3 p-3 mb-3 bg-light-subtle">
                <h6 className="small fw-semibold mb-2">RSVP responses page</h6>
                <p className="text-muted small mb-3">
                  These settings power analytics on the public RSVP link (expected visitors,
                  awaiting replies, and days remaining).
                </p>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small" htmlFor="rsvp-expected-guests">
                      Expected number of visitors
                    </label>
                    <input
                      id="rsvp-expected-guests"
                      type="number"
                      min={1}
                      step={1}
                      className="form-control form-control-sm"
                      value={expectedGuestCount}
                      onChange={(e) => setExpectedGuestCount(e.target.value)}
                      placeholder="e.g. 150"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small" htmlFor="rsvp-confirmation-deadline">
                      Confirmation deadline
                    </label>
                    <input
                      id="rsvp-confirmation-deadline"
                      type="date"
                      className="form-control form-control-sm"
                      value={rsvpDeadline}
                      onChange={(e) => setRsvpDeadline(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="form-label small mb-0">Form fields</span>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={addField}>
                  <i className="bi bi-plus-lg me-1" aria-hidden="true" />
                  Add field
                </button>
              </div>

              {fields.length === 0 && (
                <p className="text-muted small">No fields yet. Add at least one field for guests to fill in.</p>
              )}

              <ul className="list-group list-group-flush ts-rsvp-field-list">
                {fields.map((field, index) => (
                  <li key={field.id} className="list-group-item px-0 py-3">
                    <div className="d-flex align-items-start gap-2">
                      <span className="text-muted small pt-1">{index + 1}.</span>
                      <div className="flex-grow-1">
                        <div className="row g-2">
                          <div className="col-md-5">
                            <label className="form-label small">Label</label>
                            <input
                              className="form-control form-control-sm"
                              value={field.label}
                              onChange={(e) => updateField(field.id, { label: e.target.value })}
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small">Type</label>
                            <select
                              className="form-select form-select-sm"
                              value={field.type}
                              onChange={(e) =>
                                updateField(field.id, {
                                  type: e.target.value as RsvpField['type'],
                                })
                              }
                            >
                              {RSVP_FIELD_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-3 d-flex align-items-end">
                            <div className="form-check mb-2">
                              <input
                                id={`rsvp-req-${field.id}`}
                                className="form-check-input"
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateField(field.id, { required: e.target.checked })}
                              />
                              <label className="form-check-label small" htmlFor={`rsvp-req-${field.id}`}>
                                Required
                              </label>
                            </div>
                          </div>
                          <div className="col-md-8">
                            <label className="form-label small">Placeholder</label>
                            <input
                              className="form-control form-control-sm"
                              value={field.placeholder ?? ''}
                              onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                            />
                          </div>
                          {field.type === 'select' && (
                            <div className="col-12">
                              <label className="form-label small">Options (one per line)</label>
                              <textarea
                                className="form-control form-control-sm"
                                rows={2}
                                value={(field.options ?? []).join('\n')}
                                onChange={(e) =>
                                  updateField(field.id, {
                                    options: e.target.value
                                      .split('\n')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        title="Delete field"
                        onClick={() => removeField(field.id)}
                      >
                        <i className="bi bi-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                Save form
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" aria-hidden="true" onClick={onClose} />
    </>,
    document.body,
  )
}

export default RsvpFormEditorModal
