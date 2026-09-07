// OAuthCallbackPage — consumer side. The browser lands here (own origin)
// after the home server's consent screen redirects back with ?code&state.
// Validates `state` against what LoginPage stashed before leaving (login-CSRF
// guard), then exchanges the code for a locally-issued visiting session via
// oauthExchangeAsync (client.oauth.exchange — see authSlice.js).
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { oauthExchangeAsync } from './authSlice'

export default function OAuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const ran = useRef(false)

  const [status, setStatus] = useState('exchanging') // 'exchanging' | 'error'
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code = params.get('code')
    const state = params.get('state')
    const expectedState = sessionStorage.getItem('kowloon_oauth_state')
    const homeDomain = sessionStorage.getItem('kowloon_oauth_home')
    sessionStorage.removeItem('kowloon_oauth_state')
    sessionStorage.removeItem('kowloon_oauth_home')

    // Wrapped in an async fn so every failure path (validation or exchange)
    // resolves through the same .catch() below, rather than calling
    // setState synchronously during the effect's own execution.
    async function run() {
      if (!code || !homeDomain) {
        throw new Error('Missing authorization code.')
      }
      if (!state || state !== expectedState) {
        throw new Error('This sign-in attempt could not be verified. Please try again.')
      }
      await dispatch(oauthExchangeAsync({ code, homeDomain })).unwrap()
      navigate('/', { replace: true })
    }

    run().catch((err) => {
      setStatus('error')
      setErrorMsg(err?.message || err || 'Could not complete sign-in.')
    })
  }, [params, dispatch, navigate])

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-8">
      <div className="w-full max-w-sm mx-auto">

        <div className="mb-10">
          <h1 className="font-display text-6xl leading-none tracking-wide text-base-content">KOWLOON</h1>
          <div className="w-8 h-0.5 bg-primary mt-3" />
        </div>

        {status === 'exchanging' && (
          <p className="font-ui text-xs uppercase tracking-widest text-base-content/50 animate-pulse">
            Signing you in…
          </p>
        )}

        {status === 'error' && (
          <div className="flex flex-col gap-6">
            <div className="px-4 py-4 border-l-4 border-error bg-error/5">
              <p className="font-ui text-xs uppercase tracking-widest text-error">{errorMsg}</p>
            </div>
            <p className="font-ui text-xs uppercase tracking-widest text-base-content/40">
              <Link to="/login" className="text-primary hover:opacity-70 transition-opacity">
                Back to sign in
              </Link>
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
