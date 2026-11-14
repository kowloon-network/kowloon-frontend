// UserPage — profile: avatar, bio, links, stats, public circles, and post feed.

import ReportDialog from '../components/ui/ReportDialog'
import { useParams, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { MoreHorizontal, Pencil, ExternalLink, MapPin } from 'lucide-react'
import { useClient } from '../hooks/useClient'
import { toast } from '../app/toast'
import PostList from '../components/posts/PostList'
import PostTypeIcon from '../components/ui/PostTypeIcon'
import CircleIcon from '../components/ui/CircleIcon'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'
import AddToCircleButton from '../components/circles/AddToCircleButton'
import sizedUrl from '../lib/sizedUrl'
import { toggleType, clearTypes } from '../app/feedSlice'

const hexMask = {
  WebkitMaskImage: 'url(/hex-mask.svg)',
  maskImage: 'url(/hex-mask.svg)',
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
}

// ── Sub-components ────────────────────────────────────────────────────────────

const POST_TYPES = ['Note', 'Article', 'Media', 'Event', 'Link']

function TypeFilter() {
  const dispatch = useDispatch()
  const { activeTypes } = useSelector((state) => state.feed)
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-0 border-b border-base-300 pb-3">
      <button onClick={() => dispatch(clearTypes())} className={`px-3 py-2 font-ui text-xs uppercase tracking-widest transition-colors border-r border-base-300 ${activeTypes.length === 0 ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'}`}>
        {t('feed.all')}
      </button>
      {POST_TYPES.map((type) => {
        const active = activeTypes.includes(type)
        return (
          <button key={type} onClick={() => dispatch(toggleType(type))} title={type} className={`flex items-center gap-1.5 px-3 py-2 font-ui text-xs uppercase tracking-widest transition-colors border-r border-base-300 last:border-r-0 ${active ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'}`}>
            <PostTypeIcon type={type} size="sm" />
            <span className="hidden sm:inline">{t({ Note: 'feed.notes', Article: 'feed.articles', Media: 'feed.media', Event: 'feed.events', Link: 'feed.links' }[type] ?? type)}</span>
          </button>
        )
      })}
    </div>
  )
}

function CircleChip({ circle }) {
  return (
    <Link to={`/circles/${encodeURIComponent(circle.id)}`} className="flex items-center gap-2 px-3 py-2 border border-base-300 hover:border-primary hover:bg-base-200 transition-colors">
      {circle.icon
        ? <img loading="lazy" src={sizedUrl(circle.icon, 200)} alt={circle.name} className="w-6 h-6 object-cover" style={hexMask} />
        : <CircleIcon type="circle" size="sm" />
      }
      <span className="font-ui text-xs uppercase tracking-widest text-base-content/80">{circle.name}</span>
      <span className="font-ui text-xs uppercase tracking-widest text-base-content/45">{circle.memberCount}</span>
    </Link>
  )
}

// ── Block / mute overflow menu ────────────────────────────────────────────────
// Mirrors the mobile ProfileActions sheet (block / mute). Add-to-circle stays as
// its own primary button; this kebab holds the destructive actions behind a confirm.

function ProfileActionsMenu({ user, client }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  const handleMute = async () => {
    setOpen(false)
    if (!window.confirm(t('user.muteConfirm', { defaultValue: `Mute ${user.name}? Their posts won't appear in your feeds.` }))) return
    try {
      await client.activities.mute({ userId: user.id })
      toast.success(t('user.muted', { defaultValue: `${user.name} muted` }))
    } catch (err) {
      toast.error(t('user.muteFailed', { defaultValue: 'Mute failed' }), { detail: err.message })
    }
  }

  const handleBlock = async () => {
    setOpen(false)
    if (!window.confirm(t('user.blockConfirm', { defaultValue: `Block ${user.name}? They'll be removed from your circles and can't interact with you.` }))) return
    try {
      await client.activities.block({ userId: user.id })
      toast.success(t('user.blocked', { defaultValue: `${user.name} blocked` }))
    } catch (err) {
      toast.error(t('user.blockFailed', { defaultValue: 'Block failed' }), { detail: err.message })
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        aria-label={t('user.moreActions', { defaultValue: 'More actions' })}
        className="h-full flex items-center justify-center px-4 bg-base-200 text-base-content/70 hover:text-base-content transition-colors"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 z-30 min-w-[11rem] bg-base-100 border-2 border-primary shadow-lg flex flex-col"
        >
          <button
            type="button"
            onClick={handleMute}
            className="text-left px-4 py-2.5 font-ui text-xs uppercase tracking-widest text-base-content hover:bg-base-200 transition-colors"
          >
            {t('user.mute', { defaultValue: 'Mute' })}
          </button>
          <button
            type="button"
            onClick={handleBlock}
            className="text-left px-4 py-2.5 font-ui text-xs uppercase tracking-widest text-error hover:bg-base-200 transition-colors"
          >
            {t('user.block', { defaultValue: 'Block' })}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setReportOpen(true) }}
            className="text-left px-4 py-2.5 font-ui text-xs uppercase tracking-widest text-base-content hover:bg-base-200 transition-colors"
          >
            {t('user.report', { defaultValue: 'Report' })}
          </button>
        </div>
      )}
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetId={user.id}
        noun="person"
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UserPage() {
  const { id } = useParams()
  const client = useClient()
  const authUser = useSelector((state) => state.auth.user)
  const { t } = useTranslation()

  const [user, setUser]         = useState(null)
  const [posts, setPosts]       = useState([])
  const [circles, setCircles]   = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const containerRef = useRef(null)
  const [shadowProgress, setShadowProgress] = useState(0)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    setError(null)
    try {
      const [userRes, postsRes, circlesRes, bookmarksRes] = await Promise.all([
        client.feeds.getUser({ userId: id }),
        client.feeds.getUserPosts({ userId: id }),
        client.feeds.getUserCircles({ userId: id }),
        client.feeds.getUserBookmarks({ userId: id, type: 'Bookmark' }).catch(() => null),
      ])

      // Unwrap { item: {...} } envelope and normalize ActivityPub → component shape
      const raw = userRes?.item ?? userRes
      // Prefer the Kowloon @user@domain handle; fall back to id only when it
      // already looks like a handle (id can be the actorId URL in AP shape).
      const looksLikeHandle = (s) => typeof s === 'string' && /^@[^@]+@[^@]+$/.test(s)
      const handle = raw?.handle
        ?? (looksLikeHandle(raw?.id) ? raw.id : null)
        ?? (raw?.preferredUsername && raw?.domain ? `@${raw.preferredUsername}@${raw.domain}` : null)
      const normalized = {
        id: handle ?? raw?.id ?? raw?.actorId,
        handle,
        username: raw?.preferredUsername ?? raw?.username,
        name: raw?.name ?? raw?.preferredUsername ?? raw?.username,
        profile: {
          description: raw?.summary ?? raw?.profile?.description,
          icon: (() => {
            const rawIcon = raw?.icon ?? raw?.profile?.icon
            return typeof rawIcon === 'string' ? rawIcon : (rawIcon?.url ?? null)
          })(),
          pronouns: raw?.profile?.pronouns,
          urls: raw?.profile?.urls ?? (raw?.url ? [raw.url] : []),
          featuredImage: (() => {
            const f = raw?.profile?.featuredImage ?? raw?.featuredImage
            return typeof f === 'string' ? f : (f?.url ?? null)
          })(),
          location: raw?.profile?.location ?? raw?.location ?? null,
        },
      }
      setUser(normalized)

      const fallbackActor = {
        id: normalized.id,
        name: normalized.name,
        icon: normalized.profile?.icon,
      }
      const rawPosts = postsRes?.orderedItems ?? postsRes ?? []
      setPosts(rawPosts.map((p) => ({
        ...p,
        actor: p.actor ?? fallbackActor,
        published: p.published ?? p.publishedAt ?? p.createdAt,
        visibility: p.visibility ?? (p.to === '@public' ? 'Public' : p.to?.startsWith('@') ? 'Server' : 'Audience'),
      })))

      setCircles(circlesRes?.orderedItems ?? circlesRes ?? [])
      setBookmarks((bookmarksRes?.orderedItems ?? bookmarksRes ?? []).slice(0, 5))
    } catch (err) {
      setError(err.message || 'Failed to load user.')
    } finally {
      setLoading(false)
    }
  }, [client, id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let parent = el.parentElement
    while (parent && getComputedStyle(parent).overflowY === 'visible') parent = parent.parentElement
    if (!parent) return
    const handleScroll = () => setShadowProgress(Math.min(parent.scrollTop / 60, 1))
    parent.addEventListener('scroll', handleScroll, { passive: true })
    return () => parent.removeEventListener('scroll', handleScroll)
  }, [])

  if (loading) return <Spinner centered />
  if (error)   return <ErrorState message={error} onRetry={load} />
  if (!user)   return null

  const isOwnProfile = authUser && (authUser.id === user.id || authUser.username === user.username)
  const isLoggedIn   = !!authUser

  const bannerUrl = isOwnProfile ? (authUser.profile?.featuredImage ?? user.profile?.featuredImage) : user.profile?.featuredImage

  return (
    <div ref={containerRef} className="flex flex-col gap-8">

      {/* Cover banner — scrolls away above the sticky header */}
      {bannerUrl && (
        <div className="w-full overflow-hidden" style={{ aspectRatio: '3 / 1' }}>
          <img src={sizedUrl(bannerUrl, 1200)} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Profile header — avatar + name, then bio, then a full-width action row
          (Add to Circle + more), matching the mobile app. */}
      <div className="bg-base-100 flex flex-col gap-4 pt-6 pb-6 px-4 border-b-2 border-base-300">
        <div className="flex items-start gap-4">
          <img src={sizedUrl(isOwnProfile ? (authUser.profile?.icon ?? user.profile?.icon) : user.profile?.icon, 400)} alt={user.name} className="w-20 h-20 rounded-full object-cover shrink-0" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <div className="flex flex-col gap-2 min-w-0 pt-1 flex-1">
            <h1 className="font-display text-4xl leading-none tracking-wide">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-ui text-xs uppercase tracking-widest text-base-content/65">{user.handle ?? user.id}</span>
              {user.profile?.pronouns && <span className="font-ui text-xs uppercase tracking-widest text-base-content/45">{user.profile.pronouns}</span>}
              {user.profile?.location?.name && (
                <span className="flex items-center gap-1 font-ui text-xs uppercase tracking-widest text-base-content/45">
                  <MapPin size={10} />{user.profile.location.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {user.profile?.description && <p className="font-reading text-base text-base-content/80 leading-relaxed">{user.profile.description}</p>}

        {user.profile?.urls?.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {user.profile.urls.map((url) => {
              let display = url
              try { display = new URL(url).hostname.replace(/^www\./, '') } catch {}
              return (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-ui text-xs uppercase tracking-widest text-primary hover:opacity-70 transition-opacity">
                  <ExternalLink size={10} />{display}
                </a>
              )
            })}
          </div>
        )}

        {isLoggedIn && !isOwnProfile && (
          <div className="flex items-stretch gap-2">
            <AddToCircleButton user={user} />
            <ProfileActionsMenu user={user} client={client} />
          </div>
        )}
        {isOwnProfile && (
          <Link to="/profile" className="flex items-center justify-center gap-1.5 py-2.5 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary transition-colors">
            <Pencil size={12} /> {t('user.editProfile', { defaultValue: 'Edit Profile' })}
          </Link>
        )}
      </div>

      {/* Public circles */}
      {circles.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-2xl tracking-wide">{t('circle.circles', { defaultValue: 'Circles' })}</h2>
          <div className="flex flex-wrap gap-2">
            {circles.map((c) => <CircleChip key={c.id} circle={c} />)}
          </div>
        </div>
      )}

      {/* Public bookmarks */}
      {bookmarks.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl tracking-wide">{t('bookmark.bookmarks', { defaultValue: 'Bookmarks' })}</h2>
            <Link
              to={`/users/${encodeURIComponent(user.id)}/bookmarks`}
              className="font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-primary transition-colors"
            >
              {t('common.viewAll', { defaultValue: 'View all' })} →
            </Link>
          </div>
          <div className="flex flex-col border border-base-300">
            {bookmarks.map((b) => {
              const href = b.href ?? b.target
              return (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-base-300 last:border-b-0 hover:bg-base-200 transition-colors">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-ui text-sm text-primary hover:opacity-70 transition-opacity flex-1 min-w-0 truncate">
                      {b.title}
                    </a>
                  ) : (
                    <span className="font-ui text-sm flex-1 min-w-0 truncate">{b.title}</span>
                  )}
                  {b.tags?.slice(0, 3).map((tag) => (
                    <span key={tag} className="font-ui text-xs uppercase tracking-widest text-base-content/45 bg-base-300 px-1.5 py-0.5 shrink-0">
                      {tag}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Posts */}
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-2xl tracking-wide">{t('user.posts', { defaultValue: 'Posts' })}</h2>
        <TypeFilter />
        <PostList posts={posts} onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))} />
      </div>

    </div>
  )
}
