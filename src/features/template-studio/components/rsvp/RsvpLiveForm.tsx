import { useState, type CSSProperties, type FormEvent } from 'react'
import { normalizeRsvpElement } from '../../lib/rsvpFields'
import { submitPublicRsvp, RsvpSubmitError } from '../../../../services/templateStudioApi'
import type { RsvpElement } from '../../types/schema'
import RsvpFormFields from './RsvpFormFields'

type RsvpLiveFormProps = {
  element: RsvpElement
  invitationSlug: string
  style: CSSProperties
  pageScale: number
}

const RsvpLiveForm = ({ element, invitationSlug, style, pageScale }: RsvpLiveFormProps) => {
  const rsvp = normalizeRsvpElement(element)
  const [values, setValues] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [successMessage, setSuccessMessage] = useState(rsvp.successMessage ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})
    setSubmitting(true)
    try {
      const result = await submitPublicRsvp(invitationSlug, {
        element_id: element.id,
        fields: values,
      })
      setSuccessMessage(result.success_message)
      setSubmitted(true)
    } catch (err) {
      if (err instanceof RsvpSubmitError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors)
        return
      }
      setFormError(err instanceof Error ? err.message : 'Could not submit RSVP.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div
        style={style}
        className="invitation-el invitation-el--rsvp p-3 bg-white rounded shadow-sm text-center"
      >
        <p className="mb-0 small" style={{ fontSize: 14 * pageScale }}>
          {successMessage}
        </p>
      </div>
    )
  }

  return (
    <form
      style={style}
      className="invitation-el invitation-el--rsvp p-3 bg-white rounded shadow-sm overflow-auto"
      onSubmit={(e) => void onSubmit(e)}
    >
      <h2 className="h6 mb-2" style={{ fontSize: 16 * pageScale }}>
        {rsvp.heading}
      </h2>
      <RsvpFormFields
        element={rsvp}
        values={values}
        onChange={(fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }))}
        fieldErrors={fieldErrors}
        disabled={submitting}
      />
      {formError && <div className="alert alert-danger py-1 px-2 small mb-2">{formError}</div>}
      <button type="submit" className="btn btn-primary btn-sm w-100" disabled={submitting}>
        {submitting ? 'Sending…' : rsvp.submitLabel}
      </button>
    </form>
  )
}

export default RsvpLiveForm
