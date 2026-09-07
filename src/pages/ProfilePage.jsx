// ProfilePage — edit current user's profile and preferences.
// Sections: Avatar, Identity, Bio/Links, Preferences, Account (read-only).

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Upload, Plus, X, Check } from 'lucide-react'
import { PREFS, PREF_GROUPS, getPrefValue } from '@kowloon/client'
import { useClient } from '../hooks/useClient'
import CircleSelector from '../components/circles/CircleSelector'
import { useJoinedGroups } from '../hooks/useJoinedGroups'
import { setActiveTheme } from '../features/theme/themeSlice'
import { patchUser } from '../features/auth/authSlice'
import { useTypography } from '../lib/TypographyProvider'
import {
  FONTS,
  FONT_SIZE_ORDER, FONT_SIZE_LABELS,
  LINE_SPACING_ORDER, LINE_SPACING_LABELS,
  COLUMN_WIDTH_ORDER, COLUMN_WIDTH_LABELS,
} from '../lib/typography'

const hexMask = {
  WebkitMaskImage: 'url(/hex-mask.svg)',
  maskImage: 'url(/hex-mask.svg)',
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
}

// ── Mock user (fallback when not auth'd in dev) ───────────────────────────────

const MOCK_USER = {
  id: '@jzellis@kwln.org',
  username: 'jzellis',
  displayName: 'Joshua Ellis',
  profile: {
    name: 'Joshua Ellis',
    description: 'Writer, musician, technologist. Making things on the internet since 1994. Currently building Kowloon.',
    icon: 'https://picsum.photos/seed/jzellis/400/400',
    urls: ['https://jzellis.com', 'https://github.com/jzellis'],
    pronouns: 'he/him',
  },
  preferences: {
    defaultPostTypes: ['Note', 'Article'],
  },
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-4 pb-8 border-b border-base-300 last:border-b-0">
      <h2 className="font-display text-2xl tracking-wide">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">{label}</label>
      {children}
      {hint && <p className="font-reading text-xs text-base-content/40 italic">{hint}</p>}
    </div>
  )
}

// Foreign servers currently able to act as this user via a cross-server
// OAuth grant (see features/auth/authSlice.js's oauthExchangeAsync — this is
// the OTHER side of that: servers THIS account has granted access to, not
// servers this account is visiting). Revoking cuts a domain off immediately
// (client.oauth.revoke -> server checks the block/grant state on every
// request, not just at grant time — see kowloon repo's routes/outbox/post.js).
function ConnectedServersSection({ client, t }) {
  const [grants, setGrants] = useState(null) // null = loading
  const [busyDomain, setBusyDomain] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    client?.oauth?.listGrants?.()
      .then((list) => { if (!cancelled) setGrants(list) })
      .catch(() => { if (!cancelled) setGrants([]) })
    return () => { cancelled = true }
  }, [client])

  if (grants !== null && grants.length === 0) return null

  const handleRevoke = async (clientDomain) => {
    setBusyDomain(clientDomain)
    setError(null)
    try {
      await client.oauth.revoke({ clientDomain })
      setGrants((prev) => prev.filter((g) => g.clientDomain !== clientDomain))
    } catch (err) {
      setError(err.message || 'Failed to revoke')
    } finally {
      setBusyDomain(null)
    }
  }

  return (
    <Section title={t('profile.connectedServers', { defaultValue: 'Connected Servers' })}>
      <p className="font-reading text-xs text-base-content/40 italic -mt-2">
        {t('profile.connectedServersHint', {
          defaultValue: 'Servers you\'ve signed into with this identity and can currently act as you.',
        })}
      </p>
      {error && (
        <span role="alert" className="font-ui text-xs uppercase tracking-widest text-error">{error}</span>
      )}
      {grants === null ? (
        <p className="font-ui text-xs uppercase tracking-widest text-base-content/40 animate-pulse">
          {t('common.loading', { defaultValue: 'Loading…' })}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-base-300 border-2 border-base-300">
          {grants.map((g) => (
            <div key={g.clientDomain} className="flex items-center justify-between px-4 py-3">
              <span className="font-ui text-sm">{g.clientDomain}</span>
              <button
                type="button"
                onClick={() => handleRevoke(g.clientDomain)}
                disabled={busyDomain === g.clientDomain}
                className="flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-error hover:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <X size={13} />
                {busyDomain === g.clientDomain
                  ? t('common.working', { defaultValue: 'Working…' })
                  : t('profile.revoke', { defaultValue: 'Revoke' })
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text', readOnly = false }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`w-full px-4 py-3 border-2 font-ui text-sm tracking-wide outline-none transition-colors ${
        readOnly
          ? 'bg-base-200 border-base-300 text-base-content/50 cursor-default'
          : 'bg-base-100 border-base-300 focus:border-primary text-base-content placeholder:text-base-content/30'
      }`}
    />
  )
}

// ── Segmented control (stepped typography prefs) ──────────────────────────────

function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex items-center border border-base-300 self-start">
      {options.map(({ key, label }) => {
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            className={`px-3.5 py-2 font-ui text-xs uppercase tracking-widest transition-colors border-r border-base-300 last:border-r-0 ${
              active ? 'bg-primary text-primary-content' : 'bg-base-100 text-base-content/60 hover:bg-base-200'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Preference toggle switch ──────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center w-10 h-5 transition-colors focus:outline-none shrink-0 ${
        checked ? 'bg-primary' : 'bg-base-300'
      }`}
    >
      <span
        className={`absolute w-3.5 h-3.5 bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ── Pill (single- / multi-select option) ──────────────────────────────────────

function PrefPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3.5 py-2 font-ui text-xs uppercase tracking-widest transition-colors border ${
        active
          ? 'bg-primary text-primary-content border-primary'
          : 'bg-base-100 text-base-content/60 border-base-300 hover:bg-base-200'
      }`}
    >
      {label}
    </button>
  )
}

// ── One preference row, rendered generically from a shared-manifest entry ──────

function PrefControl({ entry, value, onChange, isAdmin, circles, groups, serverTo }) {
  // Audience prefs store canonical `to` strings ("@public" / "@<domain>" / id).
  // The web CircleSelector speaks 'public' / 'server' / id — map between them.
  const toSelector = (v) => {
    if (v == null || v === '@public') return 'public'
    if (v === serverTo || v === '@server' || v === 'server') return 'server'
    return v
  }
  const toCanonical = (v) => {
    if (v === 'public') return '@public'
    if (v === 'server') return serverTo
    return v
  }

  switch (entry.type) {
    case 'toggle':
      return (
        <Field label={entry.label} hint={entry.hint}>
          <Toggle checked={!!value} onChange={onChange} />
        </Field>
      )
    case 'select': {
      // Hide admin-only options (e.g. the Admin home screen) from non-admins.
      const options = entry.options.filter((o) => !o.adminOnly || isAdmin)
      return (
        <Field label={entry.label} hint={entry.hint}>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <PrefPill key={o.value} label={o.label} active={value === o.value} onClick={() => onChange(o.value)} />
            ))}
          </div>
        </Field>
      )
    }
    case 'multiselect': {
      const arr = Array.isArray(value) ? value : []
      return (
        <Field label={entry.label} hint={entry.hint}>
          <div className="flex flex-wrap gap-2">
            {entry.options.map((o) => {
              const active = arr.includes(o.value)
              return (
                <PrefPill
                  key={o.value}
                  label={o.label}
                  active={active}
                  onClick={() => {
                    const next = active ? arr.filter((x) => x !== o.value) : [...arr, o.value]
                    // Never allow an empty filter — keep at least one type.
                    if (next.length) onChange(next)
                  }}
                />
              )
            })}
          </div>
        </Field>
      )
    }
    case 'audience':
      return (
        <Field label={entry.label} hint={entry.hint}>
          <CircleSelector
            circles={circles}
            groups={groups}
            value={toSelector(value)}
            onChange={(v) => onChange(toCanonical(v))}
            showAudience
          />
        </Field>
      )
    default:
      return null
  }
}

// Short labels for the Appearance segmented control — matches the app's
// Auto/Light/Dark wording (server theme.name is the longer "Kowloon Light"
// etc., used nowhere else now that the theme picker isn't a swatch grid).
const THEME_LABELS = { system: 'Auto', 'kowloon-light': 'Light', 'kowloon-dark': 'Dark' }
const BUILT_IN_THEME_IDS = ['system', 'kowloon-light', 'kowloon-dark']

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const authUser = useSelector((state) => state.auth.user)
  const { serverUrl } = useSelector((state) => state.auth)
  const { available: availableThemes, activeId: activeThemeId, serverDefault } = useSelector((state) => state.theme)
  const dispatch = useDispatch()
  const client = useClient()
  const { t } = useTranslation()
  const { typography, setTypography } = useTypography()
  const { items: myCircles } = useSelector((state) => state.myCircles)
  const joinedGroups = useJoinedGroups()

  const user = authUser ?? MOCK_USER
  // Cross-server visiting identity (see features/auth/authSlice.js's
  // oauthExchangeAsync) — the server already refuses profile-edit/upload
  // activities for a visiting session (routes/outbox/post.js's scope
  // check), but presenting a fully editable form that silently fails is
  // bad UX, so skip rendering it at all.
  const isVisiting = !!authUser?.visiting
  const homeDomain = isVisiting ? (user.id || '').split('@').pop() : null

  // Canonical "server" audience value ("@<own-domain>") and admin status, used
  // by the manifest-driven preferences below.
  const ownDomain = (() => {
    const m = /^@[^@]+@([^@]+)$/.exec(user.id || '')
    if (m) return m[1]
    try { return serverUrl ? new URL(serverUrl).host : null } catch { return null }
  })()
  const serverTo = ownDomain ? `@${ownDomain}` : '@public'
  const isAdmin = !!authUser?.isServerAdmin

  const fileInputRef = useRef(null)
  const featuredInputRef = useRef(null)

  // Profile fields
  const [displayName, setDisplayName] = useState(user.profile?.name ?? user.displayName ?? '')
  const [pronouns, setPronouns]       = useState(user.profile?.pronouns ?? '')
  const [bio, setBio]                 = useState(user.profile?.description ?? '')
  const [urls, setUrls]               = useState(user.profile?.urls ?? [])
  const [newUrl, setNewUrl]           = useState('')
  const [iconUrl, setIconUrl]         = useState(user.profile?.icon ?? '')
  const [iconPreview, setIconPreview] = useState(user.profile?.icon ?? '')
  const [featuredUrl, setFeaturedUrl]         = useState(user.profile?.featuredImage ?? '')
  const [featuredPreview, setFeaturedPreview] = useState(user.profile?.featuredImage ?? '')

  // Preferences — rendered generically from the shared manifest (@kowloon/client)
  // and written live (like theme/typography), so the Save button below only
  // covers the profile fields. `prefsRef` guards against stale bases when several
  // prefs are edited in quick succession.
  const [prefs, setPrefs] = useState(() => ({ ...(user.prefs || {}) }))
  const prefsRef = useRef(prefs)

  const writePref = useCallback((key, value) => {
    const prev = prefsRef.current
    let nextPrefs
    let payload
    if (key.startsWith('notifications.')) {
      // The Update handler replaces prefs.notifications wholesale — send it whole.
      const sub = key.slice('notifications.'.length)
      const nextNotifs = { ...(prev.notifications || {}), [sub]: value }
      nextPrefs = { ...prev, notifications: nextNotifs }
      payload = { notifications: nextNotifs }
    } else {
      nextPrefs = { ...prev, [key]: value }
      payload = { [key]: value }
    }
    prefsRef.current = nextPrefs
    setPrefs(nextPrefs)
    dispatch(patchUser({ prefs: nextPrefs }))
    if (client?.auth?._user) client.auth._user.prefs = nextPrefs
    client?.activities?.updateProfile?.({ updates: { prefs: payload } }).catch(() => {})
  }, [client, dispatch])

  // Save state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState(null)

  const handleIconFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIconPreview(URL.createObjectURL(file))
    try {
      const res = await client.files.upload({
        file,
        filename: file.name,
        contentType: file.type,
        to: '@public',
      })
      if (res?.file?.id) {
        setIconUrl(client.files.serveUrl(res.file.id))
      } else if (res?.file?.url) {
        setIconUrl(res.file.url)
      }
    } catch {
      // Preview stays; save will use previous iconUrl if upload failed
    }
  }

  const handleFeaturedFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFeaturedPreview(URL.createObjectURL(file))
    try {
      const res = await client.files.upload({
        file,
        filename: file.name,
        contentType: file.type,
        to: '@public',
      })
      if (res?.file?.id) {
        setFeaturedUrl(client.files.serveUrl(res.file.id))
      } else if (res?.file?.url) {
        setFeaturedUrl(res.file.url)
      }
    } catch {
      // Preview stays; save will use previous featuredUrl if upload failed
    }
  }

  const addUrl = () => {
    const trimmed = newUrl.trim()
    if (trimmed && !urls.includes(trimmed)) setUrls([...urls, trimmed])
    setNewUrl('')
  }

  const removeUrl = (url) => setUrls(urls.filter((u) => u !== url))

  const handleThemeSelect = (themeId) => {
    dispatch(setActiveTheme(themeId))
    if (client) {
      client.activities.updateProfile({ prefs: { theme: themeId } }).catch(() => {})
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await client.activities.updateProfile({
        updates: {
          profile: {
            name: displayName,
            description: bio,
            icon: iconUrl,
            featuredImage: featuredUrl,
            urls,
            pronouns,
          },
        },
      })
      // Update Redux store so header/avatar refresh immediately
      const profilePatch = { name: displayName, description: bio, icon: iconUrl, featuredImage: featuredUrl, urls, pronouns }
      dispatch(patchUser({ profile: profilePatch }))
      // Keep client's cached user in sync so actor fields stay fresh
      if (client.auth._user) {
        client.auth._user = {
          ...client.auth._user,
          profile: { ...client.auth._user.profile, ...profilePatch },
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (isVisiting) {
    return (
      <div className="flex flex-col gap-8">
        <div className="border-b-2 border-base-300 pb-4">
          <h1 className="font-display text-5xl tracking-wide leading-none">
            {t('profile.title', { defaultValue: 'Profile & Settings' })}
          </h1>
        </div>
        <div className="px-4 py-4 border-l-4 border-warning bg-warning/5 max-w-xl">
          <p className="font-ui text-xs uppercase tracking-widest text-warning">
            {t('profile.visitingNotice', {
              defaultValue: `Profile editing isn't available while visiting from ${homeDomain}.`,
            })}
          </p>
          <p className="font-reading text-sm text-base-content/70 mt-2">
            {t('profile.visitingNoticeDetail', { defaultValue: 'Sign in directly on ' })}
            <a href={`https://${homeDomain}/profile`} className="text-primary hover:opacity-70 transition-opacity">
              {homeDomain}
            </a>
            {t('profile.visitingNoticeDetailEnd', { defaultValue: ' to edit your profile there.' })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Page header */}
      <div className="border-b-2 border-base-300 pb-4">
        <h1 className="font-display text-5xl tracking-wide leading-none">
          {t('profile.title', { defaultValue: 'Profile & Settings' })}
        </h1>
      </div>

      {/* Avatar */}
      <Section title={t('profile.avatar', { defaultValue: 'Avatar' })}>
        <div className="flex items-center gap-6">
          <div
            className="w-20 h-20 shrink-0 rounded-full overflow-hidden bg-primary cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => fileInputRef.current?.click()}
          >
            {iconPreview && (
              <img src={iconPreview} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border-2 border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary transition-colors self-start"
            >
              <Upload size={13} />
              {t('profile.uploadAvatar', { defaultValue: 'Upload image' })}
            </button>
            <p className="font-reading text-xs text-base-content/40 italic">
              {t('profile.avatarHint', { defaultValue: 'Square images work best. Will be cropped to a hexagon.' })}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleIconFile}
          />
        </div>
      </Section>

      {/* Cover image */}
      <Section title={t('profile.coverImage', { defaultValue: 'Cover image' })}>
        <div className="flex flex-col gap-3">
          <div
            className="w-full bg-base-200 border-2 border-base-300 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
            style={{ aspectRatio: '3 / 1' }}
            onClick={() => featuredInputRef.current?.click()}
          >
            {featuredPreview && (
              <img src={featuredPreview} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => featuredInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border-2 border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary transition-colors self-start"
            >
              <Upload size={13} />
              {t('profile.uploadCover', { defaultValue: 'Upload image' })}
            </button>
            {featuredPreview && (
              <button
                type="button"
                onClick={() => { setFeaturedUrl(''); setFeaturedPreview('') }}
                className="font-ui text-xs uppercase tracking-widest text-base-content/40 hover:text-error transition-colors"
              >
                {t('common.remove', { defaultValue: 'Remove' })}
              </button>
            )}
          </div>
          <p className="font-reading text-xs text-base-content/40 italic">
            {t('profile.coverHint', { defaultValue: 'A wide banner for the top of your profile. 3:1 images work best.' })}
          </p>
          <input
            ref={featuredInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFeaturedFile}
          />
        </div>
      </Section>

      {/* Identity */}
      <Section title={t('profile.identity', { defaultValue: 'Identity' })}>
        <Field label={t('profile.displayName', { defaultValue: 'Display name' })}>
          <TextInput value={displayName} onChange={setDisplayName} placeholder={t('profile.displayNamePlaceholder', { defaultValue: 'Your name' })} />
        </Field>
        <Field label={t('profile.pronouns', { defaultValue: 'Pronouns (optional)' })}>
          <TextInput value={pronouns} onChange={setPronouns} placeholder="e.g. they/them" />
        </Field>
        <Field label={t('profile.bio', { defaultValue: 'Bio' })}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('profile.bioPlaceholder', { defaultValue: 'A little about yourself…' })}
            rows={4}
            className="w-full px-4 py-3 bg-base-100 border-2 border-base-300 focus:border-primary outline-none font-reading text-sm text-base-content placeholder:text-base-content/30 resize-none transition-colors"
          />
        </Field>
      </Section>

      {/* Links */}
      <Section title={t('profile.links', { defaultValue: 'Links' })}>
        <div className="flex flex-col gap-2">
          {urls.map((url) => {
            let display = url
            try { display = new URL(url).hostname.replace(/^www\./, '') } catch {}
            return (
              <div key={url} className="flex items-center gap-2 px-4 py-2.5 bg-base-200 border border-base-300">
                <span className="font-ui text-xs uppercase tracking-widest text-base-content/80 flex-1 truncate">{display}</span>
                <span className="font-reading text-xs text-base-content/40 truncate flex-1 hidden sm:block">{url}</span>
                <button
                  type="button"
                  onClick={() => removeUrl(url)}
                  className="p-1 text-base-content/30 hover:text-error transition-colors shrink-0"
                  aria-label={`Remove ${url}`}
                >
                  <X size={13} />
                </button>
              </div>
            )
          })}
          <div className="flex gap-2">
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } }}
              placeholder="https://…"
              className="flex-1 px-4 py-2.5 bg-base-100 border-2 border-base-300 focus:border-primary outline-none font-ui text-sm text-base-content placeholder:text-base-content/30 transition-colors"
            />
            <button
              type="button"
              onClick={addUrl}
              disabled={!newUrl.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={13} />
              {t('common.add', { defaultValue: 'Add' })}
            </button>
          </div>
        </div>
      </Section>

      {/* Appearance — Auto/Light/Dark always; "Site Theme" only appears when
          the server admin has actually set a custom (non-built-in) theme as
          the site default. Every OTHER custom theme an admin might have lying
          around (created but not set live) stays admin-only — this picker is
          "use the site's look, or override with a system one", not a full
          theme gallery. */}
      {availableThemes.length > 0 && (() => {
        const customSiteTheme = availableThemes.find(
          (theme) => theme.id === serverDefault && !BUILT_IN_THEME_IDS.includes(theme.id)
        )
        const themeOptions = [
          ...(customSiteTheme
            ? [{ key: customSiteTheme.id, label: t('profile.siteTheme', { defaultValue: 'Site Theme' }) }]
            : []),
          ...availableThemes
            .filter((theme) => BUILT_IN_THEME_IDS.includes(theme.id))
            .map((theme) => ({ key: theme.id, label: THEME_LABELS[theme.id] ?? theme.name })),
        ]
        return (
          <Section title={t('profile.appearance', { defaultValue: 'Appearance' })}>
            <Field
              label={t('profile.theme', { defaultValue: 'Theme' })}
              hint={t('profile.themeHint', { defaultValue: 'Changes apply immediately.' })}
            >
              <Segmented value={activeThemeId} onChange={handleThemeSelect} options={themeOptions} />
            </Field>
          </Section>
        )
      })()}

      {/* Reading typography */}
      <Section title={t('profile.reading', { defaultValue: 'Reading' })}>
        {/* Live preview — inherits the CSS vars TypographyProvider sets globally,
            so it updates the moment any control below changes. */}
        <div className="reading-surface border-2 border-base-300 p-5 bg-base-100">
          <div className="prose max-w-none">
            <p>
              {t('profile.readingPreview', {
                defaultValue:
                  'Kowloon is a place to read and write without an algorithm deciding what you see. Set the type the way you like it — this is how your posts and articles will read.',
              })}
            </p>
          </div>
        </div>

        <Field
          label={t('profile.typeface', { defaultValue: 'Typeface' })}
          hint={t('profile.typefaceHint', { defaultValue: 'Applies to post and article body text. Changes apply immediately.' })}
        >
          <div className="flex flex-wrap gap-2">
            {FONTS.map((f) => {
              const active = typography.fontFamily === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTypography({ fontFamily: f.key })}
                  aria-pressed={active}
                  style={{ fontFamily: f.stack }}
                  className={`px-4 py-2.5 border-2 text-left transition-colors ${
                    active ? 'border-primary' : 'border-base-300 hover:border-base-content/30'
                  }`}
                >
                  <span className="block text-lg leading-tight">{f.label}</span>
                  <span className="block font-ui text-[10px] uppercase tracking-widest text-base-content/40 mt-0.5">
                    {f.classification}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label={t('profile.textSize', { defaultValue: 'Text size' })}>
          <Segmented
            value={typography.fontSize}
            onChange={(k) => setTypography({ fontSize: k })}
            options={FONT_SIZE_ORDER.map((key) => ({ key, label: FONT_SIZE_LABELS[key] }))}
          />
        </Field>

        <Field label={t('profile.lineSpacing', { defaultValue: 'Line spacing' })}>
          <Segmented
            value={typography.lineSpacing}
            onChange={(k) => setTypography({ lineSpacing: k })}
            options={LINE_SPACING_ORDER.map((key) => ({ key, label: LINE_SPACING_LABELS[key] }))}
          />
        </Field>

        <Field
          label={t('profile.columnWidth', { defaultValue: 'Column width' })}
          hint={t('profile.columnWidthHint', { defaultValue: 'How wide a line of text runs before it wraps.' })}
        >
          <Segmented
            value={typography.columnWidth}
            onChange={(k) => setTypography({ columnWidth: k })}
            options={COLUMN_WIDTH_ORDER.map((key) => ({ key, label: COLUMN_WIDTH_LABELS[key] }))}
          />
        </Field>
      </Section>

      {/* Preferences — one Section per manifest group, controls rendered by type.
          Changes are written live (no Save button needed for these). */}
      {PREF_GROUPS.map((group) => {
        const entries = PREFS.filter((p) => p.group === group.key)
        if (!entries.length) return null
        return (
          <Section key={group.key} title={group.label}>
            {entries.map((entry) => (
              <PrefControl
                key={entry.key}
                entry={entry}
                value={getPrefValue(prefs, entry)}
                onChange={(v) => writePref(entry.key, v)}
                isAdmin={isAdmin}
                circles={myCircles}
                groups={joinedGroups}
                serverTo={serverTo}
              />
            ))}
          </Section>
        )
      })}

      {/* Account (read-only) */}
      <Section title={t('profile.account', { defaultValue: 'Account' })}>
        <Field label={t('profile.handle', { defaultValue: 'Handle' })} hint={t('profile.handleHint', { defaultValue: 'Your full federated ID — cannot be changed.' })}>
          <TextInput value={user.id} readOnly />
        </Field>
        <Field label={t('profile.server', { defaultValue: 'Server' })} hint={t('profile.serverHint', { defaultValue: 'The server this account lives on.' })}>
          <TextInput value={serverUrl ?? '(local)'} readOnly />
        </Field>
      </Section>

      <ConnectedServersSection client={client} t={t} />

      {/* Save */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t-2 border-base-300">
        {error && (
          <span role="alert" className="font-ui text-xs uppercase tracking-widest text-error">
            {error}
          </span>
        )}
        {saved && (
          <span className="flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-success">
            <Check size={13} />
            {t('common.saved', { defaultValue: 'Saved' })}
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {saving
            ? t('common.saving', { defaultValue: 'Saving…' })
            : t('common.save', { defaultValue: 'Save' })
          }
        </button>
      </div>

    </div>
  )
}
