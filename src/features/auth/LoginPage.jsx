import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { loginAsync, clearError } from './authSlice'
import PasswordInput from '../../components/ui/PasswordInput'
import AuthSplash from '../../components/auth/AuthSplash'
import { useIsDesktop } from '../../hooks/useIsDesktop'

const FIXED_SERVER = import.meta.env.VITE_SERVER_URL || window.KOWLOON_CONFIG?.apiUrl || window.location.origin
const OWN_DOMAIN = (() => {
  try { return new URL(FIXED_SERVER).hostname } catch { return window.location.hostname }
})()

// Parses "@user@domain", "user@domain", or a bare "user" (this site).
function parseKowloonId(raw) {
  const s = String(raw || '').trim().replace(/^@/, '')
  const parts = s.split('@')
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { username: parts[0], domain: parts[1].toLowerCase() }
  }
  return { username: s, domain: null }
}

// Begins the cross-server OAuth flow: top-level navigation to the home
// server's own /oauth/authorize consent page (a frontend route there, not a
// direct API call) — the user only ever types their password on their own
// home server's real login page. `state` guards against login CSRF: an
// attacker-initiated code being fed back into this browser's callback.
function redirectToHomeServer(domain) {
  const state = crypto.randomUUID()
  sessionStorage.setItem('kowloon_oauth_state', state)
  sessionStorage.setItem('kowloon_oauth_home', domain)
  const redirectUri = `https://${OWN_DOMAIN}/oauth/callback`
  const url = `https://${domain}/oauth/authorize?client_domain=${encodeURIComponent(OWN_DOMAIN)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
  window.location.href = url
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">{label}</label>
        {hint && <span className="font-ui text-xs uppercase tracking-widest text-base-content/30">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export default function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, sessionChecked, status, error } = useSelector((state) => state.auth)
  const { t } = useTranslation()
  // Two AuthSplash spots (desktop panel / mobile banner) are mutually
  // exclusive by viewport — only mount the one that's actually visible, so
  // its animation loop doesn't run twice at once just because a plain CSS
  // `hidden` class is hiding the other copy.
  const isDesktop = useIsDesktop()

  const [serverUrl, setServerUrl] = useState(FIXED_SERVER || '')
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')

  const successMsg = searchParams.get('verified') === 'success'
    ? 'Email verified! You can now sign in.'
    : searchParams.get('reset') === 'success'
    ? 'Password updated. Sign in with your new password.'
    : null
  // Set by the client's session-expiry handler when a token stopped working (#57).
  const expiredMsg = searchParams.get('expired') === '1'
    ? 'Your session expired. Please sign in again.'
    : null

  const returnTo = searchParams.get('return_to')

  useEffect(() => { dispatch(clearError()) }, [dispatch])
  useEffect(() => {
    if (sessionChecked && user) {
      navigate(returnTo ? decodeURIComponent(returnTo) : '/', { replace: true })
    }
  }, [sessionChecked, user, navigate, returnTo])

  const isLoading = status === 'loading'

  // Recomputed on every keystroke so the form can drop the password field
  // (and its `required` attribute) the moment a foreign domain is typed —
  // it's never needed here, since a foreign ID redirects to its own home
  // server's login page instead of collecting a password on this page.
  const { domain: foreignDomain } = parseKowloonId(username)
  const isForeign = !!(foreignDomain && foreignDomain !== OWN_DOMAIN)

  const handleSubmit = (e) => {
    e.preventDefault()
    const { username: parsedUsername, domain } = parseKowloonId(username)
    if (domain && domain !== OWN_DOMAIN) {
      redirectToHomeServer(domain)
      return
    }
    dispatch(loginAsync({ serverUrl: serverUrl.trim(), username: parsedUsername, password }))
  }

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="font-ui text-xs uppercase tracking-widest text-base-content/40 animate-pulse">
          {t('common.loading', { defaultValue: 'Loading…' })}
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-stretch">

      {/* Left — decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-secondary flex-col justify-between p-12 relative overflow-hidden">
        {isDesktop ? <AuthSplash /> : null}
        {/* Scrim — the animated scene behind is colorful in both day and
            night modes; this guarantees the overlaid text stays legible
            regardless of which scene is showing. */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.45))',
        }} />

        <div className="relative z-10">
          <div className="w-12 h-1 bg-primary mb-8" />
          <p className="font-ui text-xs uppercase tracking-widest text-white/70">
            {t('app.tagline', { defaultValue: 'Your space on the open web' })}
          </p>
        </div>

        <div className="relative z-10">
          <h1 className="font-display text-9xl leading-none tracking-wide text-white">
            KOWLOON
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/20" />
            <span className="font-ui text-xs uppercase tracking-widest text-white/50">kwln.org</span>
          </div>
        </div>

        <div className="relative z-10">
          <p className="font-reading text-sm text-white/70 leading-relaxed max-w-xs">
            {t('app.description', { defaultValue: 'An open-source, federated social platform built for people who care about what they share.' })}
          </p>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16 bg-base-100">
        <div className="w-full max-w-sm mx-auto">

          {/* Mobile splash banner — full-bleed (cancels the panel's own
              px-8/px-16 via negative margin), same AuthSplash the desktop
              decorative panel uses, just shorter and with its own scrim +
              wordmark since there's no side panel at this width. */}
          <div className="lg:hidden relative -mx-8 mb-10 aspect-[1024/576] overflow-hidden bg-secondary">
            {!isDesktop ? <AuthSplash /> : null}
            {/* z-10 is required — AuthSplash's internal scene layers use an
                explicit zIndex: 1, which (since AuthSplash's own root
                establishes no stacking context of its own) is compared
                directly against these siblings, not just DOM order. Without
                it, the opaque building silhouette painted above whatever's
                behind it, and the scrim/text below only showed through in
                the scene's transparent sky gaps — exactly why "KOW" (over
                open sky) stayed visible while "LOON" (over the building)
                vanished entirely. */}
            <div className="absolute inset-0 z-10" style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.55))',
            }} />
            <div className="absolute inset-x-0 bottom-0 z-10 p-6">
              <h1 className="font-display text-3xl leading-none tracking-wide text-white">KOWLOON</h1>
              <div className="w-8 h-0.5 bg-primary mt-3" />
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-4xl leading-none tracking-wide text-base-content">
              {t('auth.loginTitle', { defaultValue: 'Sign In' })}
            </h2>
            <p className="font-ui text-xs uppercase tracking-widest text-base-content/40 mt-2">
              {t('auth.loginSubtitle', { defaultValue: 'Welcome back' })}
            </p>
          </div>

          {successMsg && (
            <div className="mb-6 px-4 py-3 border-l-4 border-success bg-success/5">
              <p className="font-ui text-xs uppercase tracking-widest text-success">{successMsg}</p>
            </div>
          )}

          {expiredMsg && !error && (
            <div className="mb-6 px-4 py-3 border-l-4 border-warning bg-warning/5">
              <p className="font-ui text-xs uppercase tracking-widest text-warning">{expiredMsg}</p>
            </div>
          )}

          {error && (
            <div role="alert" className="mb-6 px-4 py-3 border-l-4 border-error bg-error/5">
              <p className="font-ui text-xs uppercase tracking-widest text-error">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {!FIXED_SERVER && (
              <Field label={t('auth.serverUrl', { defaultValue: 'Server URL' })}>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder={t('auth.serverUrlPlaceholder', { defaultValue: 'https://kwln.org' })}
                  required
                  autoComplete="url"
                  className="w-full px-0 py-2 bg-transparent border-b-2 border-base-300 focus:border-primary outline-none font-ui text-sm tracking-wide text-base-content placeholder:text-base-content/25 transition-colors"
                />
              </Field>
            )}

            <Field
              label={t('auth.username', { defaultValue: 'Kowloon ID' })}
              hint={t('auth.usernameHint', { defaultValue: 'yours, or @you@another-server' })}
            >
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.usernamePlaceholder', { defaultValue: 'yourhandle or @yourhandle@server.example' })}
                required
                autoComplete="username"
                autoFocus={!!FIXED_SERVER}
                className="w-full px-0 py-2 bg-transparent border-b-2 border-base-300 focus:border-primary outline-none font-ui text-sm tracking-wide text-base-content placeholder:text-base-content/25 transition-colors"
              />
            </Field>

            {!isForeign && (
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between">
                  <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">
                    {t('auth.password', { defaultValue: 'Password' })}
                  </label>
                  <Link
                    to="/forgot-password"
                    tabIndex={-1}
                    className="font-ui text-xs uppercase tracking-widest text-base-content/30 hover:text-primary transition-colors"
                  >
                    {t('auth.forgotPassword', { defaultValue: 'Forgot?' })}
                  </Link>
                </div>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-0 py-2 bg-transparent border-b-2 border-base-300 focus:border-primary outline-none font-ui text-sm tracking-wide text-base-content placeholder:text-base-content/25 transition-colors"
                />
              </div>
            )}

            {isForeign && (
              <p className="font-ui text-xs uppercase tracking-widest text-base-content/40 -mt-2">
                {t('auth.foreignHint', { defaultValue: `You'll sign in on ${foreignDomain} — your password stays there.` })}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-3 w-full py-3 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {isForeign
                ? t('auth.continueTo', { defaultValue: `Continue to ${foreignDomain}` })
                : isLoading
                ? t('auth.signingIn', { defaultValue: 'Signing in…' })
                : t('auth.login', { defaultValue: 'Sign In' })
              }
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-base-300 flex flex-col gap-3">
            <p className="font-ui text-xs uppercase tracking-widest text-base-content/40">
              {t('auth.noAccount', { defaultValue: "Don't have an account?" })}{' '}
              <Link to="/register" className="text-primary hover:opacity-70 transition-opacity">
                {t('auth.signUp', { defaultValue: 'Create one' })}
              </Link>
            </p>
            <p className="font-ui text-xs uppercase tracking-widest text-base-content/40">
              <Link to="/" className="text-primary hover:opacity-70 transition-opacity">
                {t('auth.backToHome', { defaultValue: 'Back to homepage' })}
              </Link>
            </p>
          </div>

        </div>
      </div>

    </div>
  )
}
