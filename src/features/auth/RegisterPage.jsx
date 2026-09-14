import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { registerAsync, clearError } from './authSlice'
import PasswordInput from '../../components/ui/PasswordInput'
import AuthSplash from '../../components/auth/AuthSplash'
import { useIsDesktop } from '../../hooks/useIsDesktop'

const FIXED_SERVER = import.meta.env.VITE_SERVER_URL || window.KOWLOON_CONFIG?.apiUrl || window.location.origin

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

const inputCls = "w-full px-0 py-2 bg-transparent border-b-2 border-base-300 focus:border-primary outline-none font-ui text-sm tracking-wide text-base-content placeholder:text-base-content/25 transition-colors"

export default function RegisterPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, sessionChecked, status, error } = useSelector((state) => state.auth)
  const { settings: serverSettings } = useSelector((state) => state.server)
  const { t } = useTranslation()
  // Two AuthSplash spots (desktop panel / mobile banner) are mutually
  // exclusive by viewport — only mount the one that's actually visible, so
  // its animation loop doesn't run twice at once just because a plain CSS
  // `hidden` class is hiding the other copy.
  const isDesktop = useIsDesktop()

  const rules = Array.isArray(serverSettings?.rules) ? serverSettings.rules : []

  const [serverUrl, setServerUrl]           = useState(FIXED_SERVER || '')
  const [username, setUsername]             = useState('')
  const [displayName, setDisplayName]       = useState('')
  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode]         = useState(searchParams.get('invite') || '')
  const [acknowledged, setAcknowledged]     = useState({}) // { [ruleId]: true }
  const [localError, setLocalError]         = useState('')

  const allRulesAcked = rules.every((r) => acknowledged[r.id])
  const toggleRule = (id) => setAcknowledged((prev) => ({ ...prev, [id]: !prev[id] }))

  useEffect(() => { dispatch(clearError()) }, [dispatch])
  useEffect(() => {
    if (sessionChecked && user) {
      if (status === 'succeeded') {
        localStorage.setItem('kowloon_discover_welcomed', '1')
        navigate('/discover', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [sessionChecked, user, status, navigate])

  const isLoading    = status === 'loading'
  const displayError = localError || error

  const handleSubmit = (e) => {
    e.preventDefault()
    setLocalError('')
    if (password !== confirmPassword) { setLocalError(t('auth.passwordMismatch')); return }
    if (password.length < 8) { setLocalError(t('auth.passwordTooShort')); return }
    if (rules.length > 0 && !allRulesAcked) {
      setLocalError(t('auth.mustAcknowledgeRules', { defaultValue: 'Please acknowledge every server rule before registering.' }))
      return
    }
    // Username becomes the account handle (@user@domain) — must be a slug.
    if (!/^[a-z0-9_]{2,32}$/.test(username.trim())) {
      setLocalError(t('auth.usernameInvalid', { defaultValue: 'Username must be 2–32 characters: lowercase letters, numbers, or underscores only (no spaces or capitals). Put your full name in the display name.' }))
      return
    }
    dispatch(registerAsync({
      serverUrl: serverUrl.trim(),
      username: username.trim(),
      password,
      email: email.trim() || undefined,
      profile: displayName.trim() ? { name: displayName.trim() } : undefined,
      inviteCode: inviteCode.trim() || undefined,
      acknowledgedRules: rules.length > 0 ? rules.map((r) => r.id) : undefined,
    }))
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
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16 bg-base-100 overflow-y-auto">
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
              {t('auth.registerTitle', { defaultValue: 'Create Account' })}
            </h2>
            <p className="font-ui text-xs uppercase tracking-widest text-base-content/40 mt-2">
              {t('auth.registerSubtitle', { defaultValue: 'Join the network' })}
            </p>
          </div>

          {/* Kowloon has no server-wide open-signup switch — every server
              requires an invite. This reacts to whether the code is actually
              filled in yet (usually because it prefilled from ?invite=), not
              to any setting, so it disappears the moment the field is. */}
          {!inviteCode && (
            <div className="mb-6 px-4 py-3 border-l-4 border-warning bg-warning/5">
              <p className="font-ui text-xs uppercase tracking-widest text-warning/80">
                {t('auth.inviteRequired', { defaultValue: "You'll need an invite code to register — ask whoever invited you, or your server's admin." })}
              </p>
            </div>
          )}

          {displayError && (
            <div role="alert" className="mb-6 px-4 py-3 border-l-4 border-error bg-error/5">
              <p className="font-ui text-xs uppercase tracking-widest text-error">{displayError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Always required, always first — every Kowloon server requires
                an invite to register, so this is the one field that decides
                whether the rest of the form is even usable yet. Autofocus
                lands here specifically when it ISN'T prefilled, so a visitor
                who followed a bare link (not an invite link) sees the
                cursor sitting in the one field they can't skip, rather than
                discovering that on submit. */}
            <Field
              label={t('auth.inviteCode', { defaultValue: 'Invite Code' })}
              hint={inviteCode
                ? t('auth.inviteCodeFromLink', { defaultValue: 'from your invite link' })
                : t('common.required', { defaultValue: 'required' })
              }
            >
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder={t('auth.inviteCodePlaceholder', { defaultValue: 'XXXX-XXXX' })}
                required
                autoComplete="off"
                autoFocus={!inviteCode}
                className={`${inputCls} ${!inviteCode ? 'border-warning' : ''}`}
              />
            </Field>

            {!FIXED_SERVER && (
              <Field label={t('auth.serverUrl', { defaultValue: 'Server URL' })}>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder={t('auth.serverUrlPlaceholder', { defaultValue: 'https://kwln.org' })}
                  required
                  autoComplete="url"
                  className={inputCls}
                />
              </Field>
            )}

            <Field label={t('auth.username', { defaultValue: 'Username' })} hint="required">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder={t('auth.usernamePlaceholder', { defaultValue: 'yourhandle' })}
                required
                autoComplete="username"
                autoFocus={!!FIXED_SERVER && !!inviteCode}
                pattern="[a-z0-9_]{2,32}"
                title={t('auth.usernamePattern', { defaultValue: 'Lowercase letters, numbers, and underscores only (no spaces or capitals)' })}
                className={inputCls}
              />
            </Field>

            <Field label={t('auth.displayName', { defaultValue: 'Display Name' })} hint={t('common.optional', { defaultValue: 'optional' })}>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('auth.displayNamePlaceholder', { defaultValue: 'Your Name' })}
                autoComplete="name"
                className={inputCls}
              />
            </Field>

            <Field label={t('auth.email', { defaultValue: 'Email' })} hint={t('common.optional', { defaultValue: 'optional' })}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder', { defaultValue: 'you@example.com' })}
                autoComplete="email"
                className={inputCls}
              />
            </Field>

            <Field label={t('auth.password', { defaultValue: 'Password' })}>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>

            <Field label={t('auth.confirmPassword', { defaultValue: 'Confirm Password' })}>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>

            {rules.length > 0 && (
              <fieldset className="mt-2 border-t border-base-300 pt-5">
                <legend className="font-ui text-xs uppercase tracking-widest text-base-content/50 mb-3">
                  {t('auth.serverRules', { defaultValue: 'Server Rules' })}
                </legend>
                <p className="font-reading text-sm text-base-content/60 mb-4">
                  {t('auth.serverRulesIntro', { defaultValue: 'Please read and acknowledge each rule before creating your account.' })}
                </p>
                <ul className="flex flex-col gap-3">
                  {rules.map((rule) => (
                    <li key={rule.id} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id={`rule-${rule.id}`}
                        checked={!!acknowledged[rule.id]}
                        onChange={() => toggleRule(rule.id)}
                        className="mt-1.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
                      />
                      <label
                        htmlFor={`rule-${rule.id}`}
                        className="font-reading text-sm text-base-content cursor-pointer flex-1 [&_p]:m-0 [&_p+p]:mt-2 [&_a]:text-primary [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: rule.html || '' }}
                      />
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}

            <button
              type="submit"
              disabled={isLoading || (rules.length > 0 && !allRulesAcked)}
              className="mt-3 w-full py-3 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {isLoading
                ? t('auth.creating', { defaultValue: 'Creating account…' })
                : t('auth.createAccount', { defaultValue: 'Create Account' })
              }
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-base-300">
            <p className="font-ui text-xs uppercase tracking-widest text-base-content/40">
              {t('auth.haveAccount', { defaultValue: 'Already have an account?' })}{' '}
              <Link to="/login" className="text-primary hover:opacity-70 transition-opacity">
                {t('auth.logIn', { defaultValue: 'Sign in' })}
              </Link>
            </p>
          </div>

        </div>
      </div>

    </div>
  )
}
