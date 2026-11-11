// Plain helpers for moderation reports (Flags), shared by the dashboard,
// Moderation list and report page. Components live in reports.jsx.

export function fmtDate(d) {
  if (!d) return '--'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Flag.reason is an object ({code, label, description, details?}), never a
// plain string.
export function reasonLabel(reason, fallback = '--') {
  if (!reason) return fallback
  if (typeof reason === 'string') return reason
  return reason.label || reason.description || reason.code || fallback
}

// Where the reported thing lives on the site.
export function targetPath(flag) {
  if (!flag?.target) return null
  const id = flag.target
  if (id.startsWith('post:') || id.startsWith('reply:')) return `/posts/${encodeURIComponent(id)}`
  if (id.startsWith('group:')) return `/groups/${encodeURIComponent(id)}`
  if (id.startsWith('circle:')) return `/circles/${encodeURIComponent(id)}`
  if (id.startsWith('page:')) return `/pages/${encodeURIComponent(id)}`
  if (id.startsWith('@')) return `/users/${encodeURIComponent(id)}`
  return null
}

export function reportPath(flag) {
  return `/admin/moderation/${encodeURIComponent(flag.id)}`
}

// What a person would call the reported thing: its title, else an excerpt,
// else its bare ID.
export function targetLabel(flag) {
  const t = flag?.targetSummary
  if (t?.title) return t.title
  if (t?.excerpt) return t.excerpt
  if (t && t.exists === false) return 'Item no longer exists'
  return flag?.target ?? '--'
}

export function personName(person, fallbackId) {
  return person?.name || person?.id || fallbackId || '--'
}

export const TYPE_LABELS = { Reply: 'Reply', Post: 'Post', Page: 'Page', Bookmark: 'Bookmark', Group: 'Group', Circle: 'Circle', User: 'Account' }
