import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { createTag, fetchTags, type TagRecord } from '../services/tags'

export type TagSelection = Pick<TagRecord, 'id' | 'tag'>

type TagTypeaheadInputProps = {
  id?: string
  label: string
  value: TagSelection[]
  onChange: (tags: TagSelection[]) => void
  disabled?: boolean
  placeholder?: string
}

const TagTypeaheadInput = ({
  id: idProp,
  label,
  value,
  onChange,
  disabled = false,
  placeholder = 'Type to search or add a tag…',
}: TagTypeaheadInputProps) => {
  const autoId = useId()
  const inputId = idProp ?? `tag-input-${autoId}`
  const listboxId = `${inputId}-listbox`

  const [draft, setDraft] = useState('')
  const [suggestions, setSuggestions] = useState<TagRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [creating, setCreating] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const loadSuggestions = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const rows = await fetchTags(query)
      setSuggestions(rows.filter((r) => !value.some((v) => v.id === r.id)))
      setHighlight(0)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [value])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      void loadSuggestions(draft)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [draft, open, loadSuggestions])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const addTag = (tag: TagSelection) => {
    if (value.some((t) => t.id === tag.id)) return
    onChange([...value, tag])
    setDraft('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const removeTag = (tagId: number) => {
    onChange(value.filter((t) => t.id !== tagId))
  }

  const resolveAndAdd = async (raw: string) => {
    const text = raw.trim()
    if (!text) return

    const existingSelected = value.find(
      (t) => t.tag.localeCompare(text, undefined, { sensitivity: 'accent' }) === 0,
    )
    if (existingSelected) {
      setDraft('')
      return
    }

    const match = suggestions.find(
      (s) => s.tag.localeCompare(text, undefined, { sensitivity: 'accent' }) === 0,
    )
    if (match) {
      addTag(match)
      return
    }

    setCreating(true)
    try {
      const created = await createTag(text)
      addTag(created)
    } catch {
      /* caller may show toast elsewhere */
    } finally {
      setCreating(false)
    }
  }

  const pickHighlighted = () => {
    if (suggestions.length > 0 && highlight >= 0 && highlight < suggestions.length) {
      addTag(suggestions[highlight])
      return
    }
    void resolveAndAdd(draft)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
      return
    }
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      void pickHighlighted()
    }
  }

  const showCreateOption =
    draft.trim().length > 0 &&
    !suggestions.some(
      (s) => s.tag.localeCompare(draft.trim(), undefined, { sensitivity: 'accent' }) === 0,
    ) &&
    !value.some(
      (t) => t.tag.localeCompare(draft.trim(), undefined, { sensitivity: 'accent' }) === 0,
    )

  const optionCount = suggestions.length + (showCreateOption ? 1 : 0)

  return (
    <div className="tag-typeahead-field" ref={boxRef}>
      <label htmlFor={inputId} className="form-label">
        {label}
      </label>
      <div
        className={`tag-typeahead-box form-control${disabled ? ' is-disabled' : ''}`}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {value.map((t) => (
          <span key={t.id} className="tag-typeahead-badge">
            {t.tag}
            <button
              type="button"
              className="tag-typeahead-badge-remove"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(t.id)
              }}
              disabled={disabled}
              aria-label={`Remove ${t.tag}`}
            >
              <i className="bi bi-x" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className="tag-typeahead-input"
          value={draft}
          disabled={disabled || creating}
          placeholder={value.length === 0 ? placeholder : ''}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {open && !disabled && (draft.trim() || suggestions.length > 0) && (
        <ul id={listboxId} className="tag-typeahead-menu" role="listbox">
          {loading && suggestions.length === 0 && (
            <li className="tag-typeahead-menu-item text-muted">Searching…</li>
          )}
          {suggestions.map((s, idx) => (
            <li key={s.id} role="option" aria-selected={highlight === idx}>
              <button
                type="button"
                className={`tag-typeahead-menu-btn${
                  highlight === idx ? ' is-active' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(s)}
              >
                {s.tag}
              </button>
            </li>
          ))}
          {showCreateOption && (
            <li role="option" aria-selected={highlight === suggestions.length}>
              <button
                type="button"
                className={`tag-typeahead-menu-btn tag-typeahead-menu-btn--create${
                  highlight === suggestions.length ? ' is-active' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void resolveAndAdd(draft)}
              >
                Create &quot;{draft.trim()}&quot;
              </button>
            </li>
          )}
          {!loading && optionCount === 0 && draft.trim() && (
            <li className="tag-typeahead-menu-item text-muted">No matches</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default TagTypeaheadInput
