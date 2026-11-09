// Client-side HTML sanitizer. Every piece of HTML the web app renders via
// innerHTML goes through here (use <SafeHtml>, never dangerouslySetInnerHTML
// directly). The server already sanitizes the bodies it generates, but the
// browser also renders HTML it did not produce: posts fetched straight from
// arbitrary remote domains (ServerPage), markdown rendered locally with
// marked, and anything a compromised/older server hands back. Defence in depth.
//
// The allowlist mirrors the server's (server/schema/Post.js, Page.js,
// Reply.js, Bookmark.js, routes/admin/settings.js — all identical), so
// legitimate server-rendered content is unchanged by this pass.

import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 's', 'u', 'a', 'ul', 'ol', 'li',
  'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'img',
]

// Per-tag attribute allowlist (DOMPurify's ALLOWED_ATTR is global, so the
// per-tag restriction is enforced in the uponSanitizeAttribute hook below).
const ALLOWED_ATTRIBUTES = {
  a: ['href', 'title', 'rel', 'target'],
  img: ['src', 'alt', 'title'],
  code: ['class'],
  pre: ['class'],
}
const ALL_ATTRS = [...new Set(Object.values(ALLOWED_ATTRIBUTES).flat())]

// http, https, mailto, or scheme-less (relative / fragment) URLs only.
const SAFE_URI = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

// Private instance so our hooks don't leak into any other DOMPurify user.
const purify = DOMPurify(window)

purify.addHook('uponSanitizeAttribute', (node, data) => {
  const tag = node.nodeName.toLowerCase()
  const allowed = ALLOWED_ATTRIBUTES[tag] ?? []
  if (!allowed.includes(data.attrName)) {
    data.keepAttr = false
    return
  }
  if (data.attrName === 'href' || data.attrName === 'src') {
    // Strip whitespace/control chars browsers ignore inside a scheme
    // ("jav\tascript:") before checking it. Also rejects data: on <img>,
    // which DOMPurify would otherwise allow by default.
    // eslint-disable-next-line no-control-regex
    const v = String(data.attrValue ?? '').replace(/[\u0000- \u007f-\u009f]/g, '')
    const m = v.match(HAS_SCHEME)
    if (m && !SAFE_SCHEMES.has(m[0].toLowerCase())) data.keepAttr = false
  }
})

purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName !== 'A' || !node.hasAttribute('target')) return
  // Only new-tab targets are meaningful here; named frame targets are dropped.
  // New-tab links always get rel=noopener noreferrer (no window.opener handle
  // for the destination page, no Referer leak).
  if (node.getAttribute('target') !== '_blank') {
    node.removeAttribute('target')
    return
  }
  node.setAttribute('rel', 'noopener noreferrer')
})

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ALL_ATTRS,
  ALLOWED_URI_REGEXP: SAFE_URI,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
}

export function sanitizeHtml(html) {
  if (html == null || html === '') return ''
  return purify.sanitize(String(html), CONFIG)
}

export default sanitizeHtml
