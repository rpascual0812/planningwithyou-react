import { useState, type ChangeEvent } from 'react'

type PasswordInputProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoComplete?: string
  required?: boolean
  minLength?: number
  placeholder?: string
}

export default function PasswordInput({
  id,
  value,
  onChange,
  disabled = false,
  autoComplete,
  required,
  minLength,
  placeholder,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="auth-password-input">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="auth-password-toggle"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        <i
          className={visible ? 'bi bi-eye-slash' : 'bi bi-eye'}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}
