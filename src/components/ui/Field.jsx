// Field — labeled text input. Underline only (no fill) — border-b-2,
// base-300 by default, primary on focus, error on error. Matches mobile's
// treatment exactly; there is no equivalent shared component on web yet —
// six pages had each hand-rolled their own local version (see
// kowloon-design/components/Field.md). This is the reconciled one.
//
// When `type="password"`, a reveal toggle (eye icon) shows up inside the
// input on the right, same as mobile — so this is a real replacement for
// PasswordInput.jsx's use case too, not just plain text fields.
//
// Contract: kowloon-design/components/Field.md

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function Field({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  hint,
  error,
  className = '',
  ...rest
}) {
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (revealed ? 'text' : 'password') : type

  const borderClass = error
    ? 'border-error'
    : focused
      ? 'border-primary'
      : 'border-base-300'

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="font-ui text-xs uppercase tracking-[0.16em] text-base-content/70">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`w-full px-0 py-2.5 ${isPassword ? 'pr-8' : ''} bg-transparent border-b-2 ${borderClass} outline-none font-ui text-base text-base-content placeholder:text-base-content/35 transition-colors ${className}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            title={revealed ? 'Hide password' : 'Show password'}
            tabIndex={-1}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-base-content/40 hover:text-base-content transition-colors"
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-1 font-ui text-xs text-error">{error}</p>
      ) : hint ? (
        <p className="mt-1 font-ui text-xs text-base-content/50">{hint}</p>
      ) : null}
    </div>
  )
}
