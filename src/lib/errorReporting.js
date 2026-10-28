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
import * as Sentry from '@sentry/browser'

let started = false

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
      beforeSend(event) {
        // Belt and braces: strip anything request- or user-shaped.
        if (event.request) {
          delete event.request.cookies
          delete event.request.data
          delete event.request.headers
        }
        if (event.user) delete event.user.ip_address
        return event
      },
    })
  } catch {
    /* error reporting must never be the thing that breaks the page */
  }
}
