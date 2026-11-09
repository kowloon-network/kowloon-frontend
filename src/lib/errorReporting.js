// Browser error reporting -> whichever tracker THIS server is configured for.
//
// The DSN is fetched at runtime from the server's /config.json
// (`errorReportingDsn`, an admin setting) rather than baked in at build time
// with a VITE_ var. That matters because Kowloon is self-hosted software:
// every operator runs the same published image, so a compiled-in DSN would
// quietly send their users' errors to whoever built the image. Runtime
// delivery lets each server point at its own tracker, or none.
//
// kwln.* servers point at our self-hosted GlitchTip (errors.kowloon.network),
// which speaks Sentry's protocol, so the stock SDK works unchanged.
//
// Fails silent and never blocks startup -- if the fetch or init throws, the
// app renders exactly as it would have.
// @sentry/browser is imported dynamically below, only once a DSN is known --
// servers without error reporting never download the SDK.

let started = false

// --- URL / text scrubbing --------------------------------------------------
// Error events and breadcrumbs carry URLs, and Kowloon URLs routinely hold
// secrets: /reset-password?token=, /verify-email?token=, OAuth ?code=/state,
// /invite/:code, search terms, Nominatim lat/lon. None of that belongs in an
// error tracker, so query strings and fragments are dropped wholesale and
// secret-bearing path segments are redacted.
const SECRET_PATH_SEGMENT = /(\/(?:invite|reset-password|verify-email)\/)[^/?#\s"'<>]+/gi

export function scrubUrl(url) {
  if (typeof url !== 'string' || !url) return url
  return url.replace(/[?#].*$/, '').replace(SECRET_PATH_SEGMENT, '$1[redacted]')
}

// For free text (exception messages, client SDK errors that embed the
// request URL): strip any query/fragment that looks like key=value pairs.
export function scrubText(text) {
  if (typeof text !== 'string' || !text) return text
  return text
    .replace(/[?#][^\s"'<>]*=[^\s"'<>]*/g, '?[redacted]')
    .replace(SECRET_PATH_SEGMENT, '$1[redacted]')
}

function scrubEvent(event) {
  if (event.request?.url) event.request.url = scrubUrl(event.request.url)
  if (event.request) delete event.request.query_string
  if (event.message) event.message = scrubText(event.message)
  if (event.logentry?.message) event.logentry.message = scrubText(event.logentry.message)
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value)
    // Stack frame filenames are bundle URLs; strip any ?v= / #hash too.
    for (const fr of ex.stacktrace?.frames ?? []) {
      if (fr.filename) fr.filename = scrubUrl(fr.filename)
      if (fr.abs_path) fr.abs_path = scrubUrl(fr.abs_path)
    }
  }
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter(Boolean)
  }
  return event
}

function scrubBreadcrumb(crumb) {
  if (!crumb) return crumb
  // Console breadcrumbs are free text and can echo anything (tokens, post
  // content, search terms) -- drop them entirely.
  if (crumb.category === 'console') return null
  if (crumb.message) crumb.message = scrubText(crumb.message)
  if (crumb.data) {
    for (const k of ['url', 'to', 'from']) {
      if (typeof crumb.data[k] === 'string') crumb.data[k] = scrubUrl(crumb.data[k])
    }
  }
  return crumb
}

export async function initErrorReporting() {
  if (started) return
  started = true
  try {
    const base =
      import.meta.env.VITE_SERVER_URL ||
      window.KOWLOON_CONFIG?.apiUrl ||
      window.location.origin

    const res = await fetch(`${base}/config.json`, { credentials: 'omit' })
    if (!res.ok) return
    const cfg = await res.json()
    const dsn = cfg?.errorReportingDsn
    if (!dsn) return

    const Sentry = await import('@sentry/browser')
    Sentry.init({
      dsn,
      // Which server this browser was talking to -- all servers serve the
      // same bundle, so without this every issue looks identical.
      serverName: cfg?.domain,
      initialScope: { tags: { kowloonServer: cfg?.domain || 'unknown' } },
      // Kowloon's pitch is privacy, and one community on these servers is a
      // reproductive-rights group. Never ship user content to the error
      // store -- a stack trace is the point. These are the SDK defaults
      // today; pinned so a future default change can't silently widen them.
      sendDefaultPii: false,
      tracesSampleRate: 0,
      // Scrub (or drop) each breadcrumb as it's recorded, so secrets never
      // sit in the in-memory buffer either.
      beforeBreadcrumb(crumb) {
        return scrubBreadcrumb(crumb)
      },
      beforeSend(event) {
        // Belt and braces: strip anything request- or user-shaped.
        if (event.request) {
          delete event.request.cookies
          delete event.request.data
          delete event.request.headers
        }
        if (event.user) delete event.user.ip_address
        // URLs (request, breadcrumbs, exception text) can carry tokens/codes.
        return scrubEvent(event)
      },
    })
  } catch {
    /* error reporting must never be the thing that breaks the page */
  }
}
