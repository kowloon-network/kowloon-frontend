// Spinner — loading state indicator.
// Props: size (sm | md | lg), centered (bool), colorClassName (defaults to
// text-primary; pass e.g. text-primary-content when nesting inside a filled
// button so the spinner matches that button's own content color)

export default function Spinner({ size = 'md', centered = false, colorClassName = 'text-primary' }) {
  const sizes = { sm: 'loading-sm', md: 'loading-md', lg: 'loading-lg' }
  const spinnerClass = `loading loading-spinner ${sizes[size]} ${colorClassName}`

  if (centered) {
    return (
      <div role="status" aria-live="polite" aria-label="Loading" className="flex items-center justify-center w-full py-12">
        <span className={spinnerClass} aria-hidden="true" />
      </div>
    )
  }

  return <span role="status" aria-live="polite" aria-label="Loading" className={spinnerClass} />
}
