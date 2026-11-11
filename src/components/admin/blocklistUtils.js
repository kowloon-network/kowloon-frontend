// Helpers for the Blocked / Defederated / banned-email admin screens.

// The domain(s) that count as "this server". The page host is the normal
// answer; the signed-in admin's own id domain covers dev setups where the web
// app runs on a different host from the API. The server's 409 on an
// unconfirmed local ban is the backstop if both miss.
export function localDomains(viewerId) {
  const out = new Set()
  if (typeof window !== 'undefined' && window.location?.host) out.add(window.location.host.toLowerCase())
  const d = idDomain(viewerId)
  if (d) out.add(d)
  return out
}

// '@name@domain' -> 'domain'; '@domain' -> 'domain'.
export function idDomain(id) {
  if (!id || typeof id !== 'string') return null
  const s = id.replace(/^@/, '')
  const at = s.lastIndexOf('@')
  return (at >= 0 ? s.slice(at + 1) : s).toLowerCase() || null
}

// Rough read of what the admin typed, for the confirm-before-ban check only.
// The server does the real parsing. Returns { kind: 'person'|'server', name, domain }.
export function parseTarget(raw) {
  let s = (raw || '').trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) {
    try {
      return { kind: 'server', domain: new URL(s).host.toLowerCase() }
    } catch {
      return null
    }
  }
  s = s.replace(/^@/, '')
  const at = s.indexOf('@')
  if (at > 0) return { kind: 'person', name: s.slice(0, at), domain: s.slice(at + 1).toLowerCase() }
  return { kind: 'server', domain: s.toLowerCase() }
}

export function isLocalPersonId(id, locals) {
  if (!id || typeof id !== 'string') return false
  const s = id.replace(/^@/, '')
  if (!s.includes('@')) return false
  return locals.has(idDomain(id))
}

export function errStatus(err) {
  return err?.status ?? err?.statusCode ?? null
}

export function fmtDay(d) {
  if (!d) return '--'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const BAN_WARNING = (name) =>
  `This permanently deletes ${name}'s account and everything they posted. It can't be undone. Use this only for known malicious accounts.`
