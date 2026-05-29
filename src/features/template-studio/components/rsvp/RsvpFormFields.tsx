import { normalizeRsvpElement } from '../../lib/rsvpFields'
import type { RsvpElement } from '../../types/schema'

type RsvpFormFieldsProps = {
  element: RsvpElement
  disabled?: boolean
  readOnly?: boolean
  values?: Record<string, string>
  onChange?: (fieldId: string, value: string) => void
  fieldErrors?: Record<string, string>
}

/** Renders RSVP field inputs from element config (editor preview + live form). */
const RsvpFormFields = ({
  element,
  disabled = false,
  readOnly = false,
  values = {},
  onChange,
  fieldErrors = {},
}: RsvpFormFieldsProps) => {
  const rsvp = normalizeRsvpElement(element)

  return (
    <>
      {rsvp.fields.map((field) => {
        const value = values[field.id] ?? ''
        const error = fieldErrors[field.id]
        const common = {
          id: `rsvp-${element.id}-${field.id}`,
          className: `form-control form-control-sm mb-2${error ? ' is-invalid' : ''}`,
          placeholder: field.placeholder || field.label,
          disabled: disabled || readOnly,
          required: field.required && !readOnly,
        }

        return (
          <div key={field.id} className="mb-1">
            <label htmlFor={common.id} className="form-label small mb-0">
              {field.label}
              {field.required && <span className="text-danger ms-1">*</span>}
            </label>
            {field.type === 'textarea' ? (
              readOnly ? (
                <textarea {...common} rows={3} readOnly defaultValue="" />
              ) : (
                <textarea
                  {...common}
                  rows={3}
                  value={value}
                  onChange={(e) => onChange?.(field.id, e.target.value)}
                />
              )
            ) : field.type === 'select' ? (
              readOnly ? (
                <select
                  {...common}
                  className={`form-select form-select-sm mb-2${error ? ' is-invalid' : ''}`}
                  defaultValue=""
                >
                  <option value="">Select…</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  {...common}
                  className={`form-select form-select-sm mb-2${error ? ' is-invalid' : ''}`}
                  value={value}
                  onChange={(e) => onChange?.(field.id, e.target.value)}
                >
                  <option value="">Select…</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )
            ) : readOnly ? (
              <input {...common} type={field.type} readOnly defaultValue="" />
            ) : (
              <input
                {...common}
                type={field.type}
                value={value}
                onChange={(e) => onChange?.(field.id, e.target.value)}
              />
            )}
            {error && <div className="invalid-feedback d-block small">{error}</div>}
          </div>
        )
      })}
    </>
  )
}

export default RsvpFormFields
