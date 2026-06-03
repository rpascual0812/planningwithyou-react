import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

export type SearchableSelectOption = {
  value: string
  label: string
}

type SearchableSelectProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  required?: boolean
  disabled?: boolean
  loading?: boolean
  emptyMessage?: string
  hint?: string
  wrapperClassName?: string
  labelClassName?: string
  /** Match Bootstrap `form-select-sm` density in toolbars. */
  size?: 'sm' | 'md'
  /** Hide the built-in label (use an external label with ``labelledBy``). */
  hideLabel?: boolean
  /** ``id`` on the trigger button (for ``htmlFor`` on external labels). */
  triggerId?: string
  /** ``aria-labelledby`` when ``hideLabel`` is true. */
  labelledBy?: string
  /** Borderless trigger for fields inside a shared control shell (e.g. account info). */
  embedded?: boolean
}

export default function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  searchPlaceholder = 'Search…',
  required = false,
  disabled = false,
  loading = false,
  emptyMessage = 'No matches',
  hint,
  wrapperClassName = 'auth-field',
  labelClassName = 'auth-label',
  size = 'md',
  hideLabel = false,
  triggerId,
  labelledBy,
  embedded = false,
}: SearchableSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, search])

  const close = useCallback(() => {
    setOpen(false)
    setSearch('')
  }, [])

  const openList = useCallback(() => {
    if (disabled || loading) return
    setOpen(true)
    window.setTimeout(() => searchRef.current?.focus(), 0)
  }, [disabled, loading])

  const selectValue = useCallback(
    (next: string) => {
      onChange(next)
      close()
    },
    [onChange, close],
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, close])

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openList()
    }
    if (event.key === 'Escape') close()
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
    if (event.key === 'Enter' && filtered.length === 1) {
      event.preventDefault()
      selectValue(filtered[0].value)
    }
  }

  const labelId = `${listId}-label`
  const triggerLabelledBy = hideLabel
    ? labelledBy
    : labelId

  return (
    <div className={wrapperClassName} ref={rootRef}>
      {!hideLabel && (
        <span className={labelClassName} id={labelId}>
          {label}
          {required && (
            <span className="searchable-select__required" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </span>
      )}

      <div
        className={`searchable-select${size === 'sm' ? ' searchable-select--sm' : ''}${
          embedded ? ' searchable-select--embedded' : ''
        }`}
      >
        <button
          type="button"
          id={triggerId}
          className={`searchable-select__trigger${open ? ' is-open' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={triggerLabelledBy || undefined}
          aria-label={hideLabel && !labelledBy ? label : undefined}
          disabled={disabled || loading}
          onClick={() => (open ? close() : openList())}
          onKeyDown={handleTriggerKeyDown}
        >
          <span
            className={
              selected ? 'searchable-select__value' : 'searchable-select__placeholder'
            }
          >
            {loading ? 'Loading…' : selected ? selected.label : placeholder}
          </span>
          <i className="bi bi-chevron-down searchable-select__chevron" aria-hidden="true" />
        </button>

        {open && (
          <div className="searchable-select__panel" role="presentation">
            <div className="searchable-select__search-wrap">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                className="searchable-select__search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={`Search ${label}`}
                autoComplete="off"
              />
            </div>
            <ul
              className="searchable-select__list"
              role="listbox"
              aria-labelledby={triggerLabelledBy || labelId}
            >
              {filtered.length === 0 ? (
                <li className="searchable-select__empty" role="presentation">
                  {emptyMessage}
                </li>
              ) : (
                filtered.map((opt) => (
                  <li key={opt.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={opt.value === value}
                      className={`searchable-select__option${
                        opt.value === value ? ' is-selected' : ''
                      }`}
                      onClick={() => selectValue(opt.value)}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {required && (
        <input
          tabIndex={-1}
          className="searchable-select__native-required"
          value={value}
          required
          onChange={() => {}}
          aria-hidden="true"
        />
      )}

      {hint && <small className="auth-hint">{hint}</small>}
    </div>
  )
}
