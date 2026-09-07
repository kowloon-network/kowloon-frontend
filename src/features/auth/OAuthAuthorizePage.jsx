// OAuthAuthorizePage — provider side. Rendered on the user's own home server
// when a foreign server's LoginPage redirects them here. Requires an actual
// local session (bounces to /login?return_to=... first if needed, same as
// any other protected page) — the user only ever types their password on
// this, their real home server. On Allow, mints a short-lived code via
// client.oauth.authorize() and hands the browser off to the foreign server's
// callback URL.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import { useClient } from '../../hooks/useClient'

export default function OAuthAuthorizePage() {
  const [params] = useSearchParams()
  const { user, sessionChecked } = useSelector((state) => state.auth)
  const client = useClient()

  const clientDomain = params.get('client_domain') || ''
  const redirectUri = params.get('redirect_uri') || ''
  const state = params.get('state') || ''

  const [status, setStatus] = useState('idle') // 'idle' | 'working' | 'error'
  const [errorMsg, setErrorMsg] = useState(null)

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="font-ui text-xs uppercase tracking-widest text-base-content/40 animate-pulse">Loading…</span>
      </div>
    )
  }

  if (!user) {
    const here = `${window.location.pathname}${window.location.search}`
    return <Navigate to={`/login?return_to=${encodeURIComponent(here)}`} replace />
  }

  if (!clientDomain || !redirectUri) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-8">
        <p className="font-ui text-xs uppercase tracking-widest text-error">
          Malformed sign-in request — missing client_domain or redirect_uri.
        </p>
      </div>
    )
  }

  const handleAllow = async () => {
    setStatus('working')
    try {
      const result = await client.oauth.authorize({ clientDomain, redirectUri, state })
      window.location.href = result.redirectUri
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message || 'Could not complete this request.')
    }
  }

  const handleDeny = () => {
    const sep = redirectUri.includes('?') ? '&' : '?'
    window.location.href = `${redirectUri}${sep}error=access_denied${state ? `&state=${encodeURIComponent(state)}` : ''}`
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-8">
      <div className="w-full max-w-sm mx-auto">

        <div className="mb-10">
          <h1 className="font-display text-6xl leading-none tracking-wide text-base-content">KOWLOON</h1>
          <div className="w-8 h-0.5 bg-primary mt-3" />
        </div>

        <div className="mb-8">
          <h2 className="font-display text-2xl leading-tight tracking-wide text-base-content">
            {clientDomain} wants to recognize you here
          </h2>
          <p className="font-ui text-xs uppercase tracking-widest text-base-content/40 mt-3">
            Signed in as {user.id}
          </p>
          <p className="font-reading text-sm text-base-content/70 mt-4 leading-relaxed">
            This lets {clientDomain} act as you there — replying, reacting, and posting — without you needing an account on that server. You can revoke this at any time by signing out on {clientDomain}.
          </p>
        </div>

        {status === 'error' && (
          <div className="mb-6 px-4 py-3 border-l-4 border-error bg-error/5">
            <p className="font-ui text-xs uppercase tracking-widest text-error">{errorMsg}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleAllow}
            disabled={status === 'working'}
            className="w-full py-3 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {status === 'working' ? 'Working…' : `Allow ${clientDomain}`}
          </button>
          <button
            type="button"
            onClick={handleDeny}
            disabled={status === 'working'}
            className="w-full py-3 border-2 border-base-300 font-ui text-xs uppercase tracking-widest hover:border-base-content/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Deny
          </button>
        </div>

      </div>
    </div>
  )
}
