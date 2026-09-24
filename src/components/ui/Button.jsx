// Button — base button component.
// Enforces sharp corners, theme tokens, and consistent sizing.
// Props: variant (primary | secondary | accent | ghost), size (sm | md | lg),
//        disabled, loading, onClick, type, children
//
// Contract: kowloon-design/components/Button.md

import Spinner from './Spinner'

const CONTENT_COLOR = {
  primary: 'text-primary-content',
  secondary: 'text-secondary-content',
  accent: 'text-accent-content',
  ghost: 'text-base-content',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  children,
  className = '',
}) {
  const isDisabled = disabled || loading

  // Disabled dims only the fill, not the label -- a dimmed label is harder
  // to read at the exact moment someone's asking "why is this disabled?"
  // Ghost has no fill to dim, so it's unaffected beyond the cursor change.
  const fills = {
    primary: isDisabled ? 'bg-primary/60' : 'bg-primary hover:opacity-90',
    secondary: isDisabled ? 'bg-secondary/60' : 'bg-secondary hover:opacity-90',
    accent: isDisabled ? 'bg-accent/60' : 'bg-accent hover:opacity-90',
    ghost: 'bg-transparent hover:bg-base-200',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        ${fills[variant]} ${CONTENT_COLOR[variant]} ${sizes[size]}
        font-ui uppercase tracking-[0.16em] transition-opacity
        inline-flex items-center justify-center gap-2
        disabled:cursor-not-allowed
        ${className}
      `}
    >
      {loading ? <Spinner size="sm" colorClassName={CONTENT_COLOR[variant]} /> : children}
    </button>
  )
}
