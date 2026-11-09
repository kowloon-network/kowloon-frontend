// SafeHtml — the ONLY sanctioned way to render an HTML string in this app.
// Runs the string through the DOMPurify allowlist in src/lib/sanitize.js
// (mirrors the server's sanitize-html allowlist) before injecting it, so
// remote/unsanitized HTML can't execute script. Any extra props (className,
// onClick, ref, htmlFor, ...) pass through to the wrapper element.

import { createElement, useMemo } from 'react'
import { sanitizeHtml } from '../../lib/sanitize'

export default function SafeHtml({ html, as = 'div', ...rest }) {
  const clean = useMemo(() => sanitizeHtml(html), [html])
  return createElement(as, { ...rest, dangerouslySetInnerHTML: { __html: clean } })
}
