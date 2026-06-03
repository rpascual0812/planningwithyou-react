import {
  useCallback,
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import {
  moveRecipientBetweenLists,
  normalizeEmailList,
  tokenizeRecipientDraft,
  validateRecipientTokens,
  type EmailCcBccValue,
  type EmailRecipientField,
  type EmailRecipientsValue,
} from '../lib/emailRecipients'
import { showErrorToast } from '../utils/toast'

const DEFAULT_FIELDS: EmailRecipientField[] = ['cc', 'bcc']

type RecipientListProps = {
  field: EmailRecipientField
  label: string
  emails: string[]
  disabled?: boolean
  dragSource: { field: EmailRecipientField; email: string } | null
  onDragSourceChange: (source: { field: EmailRecipientField; email: string } | null) => void
  onEmailsChange: (emails: string[]) => void
  onMoveToThisField: (email: string, from: EmailRecipientField) => void
}

const FIELD_LABELS: Record<EmailRecipientField, string> = {
  to: 'To',
  cc: 'CC',
  bcc: 'BCC',
}

const RecipientList = ({
  field,
  label,
  emails,
  disabled = false,
  dragSource,
  onDragSourceChange,
  onEmailsChange,
  onMoveToThisField,
}: RecipientListProps) => {
  const autoId = useId()
  const inputId = `${field}-recipients-${autoId}`
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const [draft, setDraft] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [dropActive, setDropActive] = useState(false)

  const commitTokens = useCallback(
    (raw: string) => {
      const tokens = tokenizeRecipientDraft(raw)
      if (tokens.length === 0) return true
      const err = validateRecipientTokens(tokens)
      if (err) {
        showErrorToast(err)
        return false
      }
      onEmailsChange(normalizeEmailList([...emails, ...tokens]))
      setDraft('')
      return true
    },
    [emails, onEmailsChange],
  )

  const removeAt = (index: number) => {
    onEmailsChange(emails.filter((_, i) => i !== index))
  }

  const startEdit = (index: number) => {
    if (disabled) return
    setEditingIndex(index)
    setEditDraft(emails[index] ?? '')
  }

  const commitEdit = () => {
    if (editingIndex == null) return
    const trimmed = editDraft.trim()
    if (!trimmed) {
      removeAt(editingIndex)
      setEditingIndex(null)
      setEditDraft('')
      return
    }
    const err = validateRecipientTokens([trimmed])
    if (err) {
      showErrorToast(err)
      return
    }
    const next = [...emails]
    next[editingIndex] = trimmed
    onEmailsChange(normalizeEmailList(next))
    setEditingIndex(null)
    setEditDraft('')
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setEditDraft('')
  }

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      void commitTokens(draft)
      return
    }
    if (e.key === 'Backspace' && !draft && emails.length > 0) {
      removeAt(emails.length - 1)
    }
  }

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  const handleDragStart = (e: DragEvent, email: string) => {
    if (disabled || editingIndex != null) return
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', email)
    e.dataTransfer.setData(
      'application/x-email-recipient',
      JSON.stringify({ field, email }),
    )
    onDragSourceChange({ field, email })
  }

  const handleDragEnd = () => {
    onDragSourceChange(null)
    setDropActive(false)
  }

  const handleDragOver = (e: DragEvent) => {
    if (disabled) return
    if (!e.dataTransfer.types.includes('application/x-email-recipient')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropActive(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    if (!boxRef.current?.contains(e.relatedTarget as Node)) {
      setDropActive(false)
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDropActive(false)
    if (disabled) return
    let payload: { field: EmailRecipientField; email: string } | null = null
    try {
      const raw = e.dataTransfer.getData('application/x-email-recipient')
      if (raw) payload = JSON.parse(raw) as { field: EmailRecipientField; email: string }
    } catch {
      payload = null
    }
    if (!payload?.email) return
    if (payload.field === field) return
    onMoveToThisField(payload.email, payload.field)
    onDragSourceChange(null)
  }

  const isDraggingFromHere =
    dragSource?.field === field &&
    emails.some((e) => e.toLowerCase() === dragSource.email.toLowerCase())

  return (
    <div className={`email-recipient-field${field === 'to' ? ' email-recipient-field--full' : ''}`}>
      <label htmlFor={inputId} className="form-label">
        {label}
      </label>
      <div
        ref={boxRef}
        className={`email-recipient-box form-control${
          disabled ? ' is-disabled' : ''
        }${dropActive ? ' is-drop-target' : ''}`}
        onClick={() => !disabled && editingIndex == null && inputRef.current?.focus()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {emails.map((email, index) => {
          if (editingIndex === index) {
            return (
              <input
                key={`edit-${index}`}
                type="text"
                className="email-recipient-edit-input"
                value={editDraft}
                autoFocus
                disabled={disabled}
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            )
          }
          const dimmed =
            isDraggingFromHere &&
            dragSource?.email.toLowerCase() === email.toLowerCase()
          return (
            <span
              key={`${email}-${index}`}
              className={`email-recipient-badge${dimmed ? ' is-dragging' : ''}`}
              draggable={!disabled}
              onDragStart={(e) => handleDragStart(e, email)}
              onDragEnd={handleDragEnd}
              onDoubleClick={(e) => {
                e.preventDefault()
                startEdit(index)
              }}
              title="Double-click to edit; drag between To, CC, and BCC"
            >
              {email}
              <button
                type="button"
                className="email-recipient-badge-remove"
                onClick={(e) => {
                  e.stopPropagation()
                  removeAt(index)
                }}
                disabled={disabled}
                aria-label={`Remove ${email}`}
              >
                <i className="bi bi-x" />
              </button>
            </span>
          )
        })}
        {editingIndex == null && (
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            className="email-recipient-input"
            value={draft}
            disabled={disabled}
            placeholder={emails.length === 0 ? 'Type an email and press Enter' : ''}
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={() => {
              if (draft.trim()) void commitTokens(draft)
            }}
          />
        )}
      </div>
    </div>
  )
}

export type EmailRecipientFieldsProps = {
  value: EmailRecipientsValue
  onChange: (value: EmailRecipientsValue) => void
  disabled?: boolean
  fields?: EmailRecipientField[]
}

export const EmailRecipientFields = ({
  value,
  onChange,
  disabled,
  fields = DEFAULT_FIELDS,
}: EmailRecipientFieldsProps) => {
  const [dragSource, setDragSource] = useState<{
    field: EmailRecipientField
    email: string
  } | null>(null)

  const moveToField = (email: string, from: EmailRecipientField, to: EmailRecipientField) => {
    onChange(moveRecipientBetweenLists(value, email, from, to))
  }

  const showTo = fields.includes('to')
  const showCc = fields.includes('cc')
  const showBcc = fields.includes('bcc')

  return (
    <div className="email-recipient-fields">
      {showTo && (
        <RecipientList
          field="to"
          label={FIELD_LABELS.to}
          emails={value.to}
          disabled={disabled}
          dragSource={dragSource}
          onDragSourceChange={setDragSource}
          onEmailsChange={(to) => onChange({ ...value, to })}
          onMoveToThisField={(email, from) => moveToField(email, from, 'to')}
        />
      )}
      {(showCc || showBcc) && (
        <div className="email-recipient-fields__stack">
          {showCc && (
            <RecipientList
              field="cc"
              label={FIELD_LABELS.cc}
              emails={value.cc}
              disabled={disabled}
              dragSource={dragSource}
              onDragSourceChange={setDragSource}
              onEmailsChange={(cc) => onChange({ ...value, cc })}
              onMoveToThisField={(email, from) => moveToField(email, from, 'cc')}
            />
          )}
          {showBcc && (
            <RecipientList
              field="bcc"
              label={FIELD_LABELS.bcc}
              emails={value.bcc}
              disabled={disabled}
              dragSource={dragSource}
              onDragSourceChange={setDragSource}
              onEmailsChange={(bcc) => onChange({ ...value, bcc })}
              onMoveToThisField={(email, from) => moveToField(email, from, 'bcc')}
            />
          )}
        </div>
      )}
    </div>
  )
}

type EmailCcBccFieldsProps = {
  value: EmailCcBccValue
  onChange: (value: EmailCcBccValue) => void
  disabled?: boolean
}

const EmailCcBccFields = ({ value, onChange, disabled }: EmailCcBccFieldsProps) => (
  <EmailRecipientFields
    value={{ to: [], cc: value.cc, bcc: value.bcc }}
    onChange={(next) => onChange({ cc: next.cc, bcc: next.bcc })}
    fields={['cc', 'bcc']}
    disabled={disabled}
  />
)

export default EmailCcBccFields
