// KowloonClient factory — single cached instance per server URL.
// Import getClient() anywhere you need to make API calls.
// Import clearClient() on logout to reset the cache.

import KowloonClient from '@kowloon/client'
import { normalizeImageFile } from './normalizeImage.js'

let _client = null
let _clientUrl = null

/**
 * Wrap client.files.upload so every image is baked upright (and size-capped)
 * before it leaves the browser. Covers all upload call sites at once. No-op for
 * non-image files. Idempotent — safe to call on a cached instance.
 */
function wrapUploadOrientation(client) {
  if (!client?.files?.upload || client.files.__orientWrapped) return client
  const orig = client.files.upload.bind(client.files)
  client.files.upload = async (opts) => {
    const file = await normalizeImageFile(opts?.file)
    if (file && file !== opts.file) {
      return orig({ ...opts, file, filename: file.name, contentType: file.type })
    }
    return orig(opts)
  }
  client.files.__orientWrapped = true
  return client
}

/**
 * Resolve the API base URL using, in order:
 *   1. Explicit argument (user-specified server, multi-instance mode)
 *   2. window.KOWLOON_CONFIG.apiUrl (injected by Docker entrypoint for separate deployments)
 *   3. VITE_SERVER_URL env var (build-time override for dev / custom deploys)
 *   4. localStorage (previously saved server URL)
 *   5. window.location.origin (same-origin deployment via Caddy — the default)
 */
export function resolveServerUrl(explicit) {
  return (
    explicit ||
    window.KOWLOON_CONFIG?.apiUrl ||
    import.meta.env.VITE_SERVER_URL ||
    localStorage.getItem('kowloon_server_url') ||
    window.location.origin
  )
}

// Fired by the client when a token-bearing request still 401s — the session
// expired. Clear stale auth and bounce to login instead of leaving the UI
// half-logged-in showing raw "Authentication required" errors (#57). Dynamic
// imports avoid an import cycle (store/router pull in the client); the guard
// prevents a redirect storm when several requests fail at once.
//
// Hostname-aware router import: the pics.* subdomain (see src/pics/) mounts
// its own separate `picsRouter`, not the main site's `app/router.jsx` — only
// one of the two is ever actually rendered for a given page load, so this
// must import whichever one that is, or the `.navigate()` call below targets
// an unmounted router instance and silently does nothing.
let _handlingExpiry = false
function handleSessionExpired() {
  if (_handlingExpiry) return
  _handlingExpiry = true
  const isPics = window?.location?.hostname?.startsWith('pics.')
  Promise.all([
    import('../app/store.js'),
    import('../features/auth/authSlice.js'),
    isPics ? import('../pics/picsRouter.jsx') : import('../app/router.jsx'),
  ])
    .then(async ([{ store }, { clearAuth }, routerMod]) => {
      // Remove the dead token from storage (the client already drops it on a
      // 401, but be explicit) and reset the cached client so nothing keeps
      // using the old session.
      try { await _client?.auth?.logout() } catch { /* ignore */ }
      clearClient()
      // Drafts are deliberately kept here (unlike explicit logout) so a
      // post being written when the session lapsed survives re-login.
      store.dispatch(clearAuth())
      const path = window?.location?.pathname || ''
      if (!path.startsWith('/login')) {
        routerMod.default.navigate('/login?expired=1')
      }
    })
    .catch(() => {})
    .finally(() => {
      setTimeout(() => { _handlingExpiry = false }, 1500)
    })
}

/**
 * Get (or create) a KowloonClient for the given server URL.
 * Returns null if no URL can be resolved.
 */
export function getClient(serverUrl) {
  const url = resolveServerUrl(serverUrl)
  if (!url) return null
  if (_client && _clientUrl === url) return _client
  _client = wrapUploadOrientation(
    new KowloonClient({ baseUrl: url, onUnauthorized: handleSessionExpired })
  )
  _clientUrl = url
  return _client
}

/**
 * Destroy the cached client. Call on logout or server switch.
 */
export function clearClient() {
  _client = null
  _clientUrl = null
}
