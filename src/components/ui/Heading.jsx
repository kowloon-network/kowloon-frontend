// Heading / Eyebrow — the masthead pattern (IDEOLOGY.md §1): a small
// uppercase eyebrow label plus a bold heading. Thin wrappers only — no size
// prop. Apply the named scale via className at the call site:
//   display: text-6xl md:text-9xl leading-none tracking-wide  — masthead wordmark, rare
//   title:   text-3xl md:text-4xl leading-none tracking-wide  — page-level headings
//   heading: text-xl md:text-2xl tracking-wide                — section/card titles
//
// `as` picks the HTML element (default h2) so heading hierarchy stays
// correct across a page's mix of page/section/card titles — a real page
// title passes as="h1"; there should only ever be one of those per page.
//
// Contract: kowloon-design/components/Heading.md

export function Heading({ as = 'h2', children, className = '', ...rest }) {
  const Tag = as
  return (
    <Tag className={`font-ui text-base-content ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function Eyebrow({ children, className = '', ...rest }) {
  return (
    <p
      className={`font-ui uppercase text-xs tracking-[0.25em] text-base-content/60 ${className}`}
      {...rest}
    >
      {children}
    </p>
  )
}
