// NotificationsPage — user notifications: replies, reacts, follows, join requests.
// Authenticated users only.
//
// Parity with the mobile app (mobile/app/(tabs)/notifications.js): tapping a
// row BOTH marks it read AND navigates to its source (post, group, profile…).
// The explicit check / dismiss controls remain. After any read/dismiss change
// we emit a `kowloon:unread` window event carrying the new unread count so the
// nav badges can stay live (mirrors mobile's UnreadCountContext decrement).

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useClient } from '../hooks/useClient'
import { MessageSquare, Heart, Users, Bell, Flag, X, Check, CheckCheck } from 'lucide-react'
import Timestamp from '../components/ui/Timestamp'
import UserAvatar from '../components/ui/UserAvatar'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTER_TYPES = ['all', 'reply', 'react', 'new_post', 'join_request', 'join_approved']

const NOTIF_ICONS = {
  reply:         <MessageSquare size={14} />,
  react:         <Heart         size={14} />,
  new_post:      <Bell          size={14} />,
  join_request:  <Users         size={14} />,
  join_approved: <Users         size={14} />,
  moderation:    <Flag          size={14} />,
}

const NOTIF_COLORS = {
  reply:         'text-primary',
  react:         'text-error',
  new_post:      'text-base-content/60',
  join_request:  'text-secondary',
  join_approved: 'text-secondary',
  moderation:    'text-warning',
}

// ── Routing ───────────────────────────────────────────────────────────────────

// Derive the in-app route for a notification, mirroring mobile's
// notificationRoute (src/lib/notifications.js) but mapped to web paths.
// Primary source is the clean objectType/objectId pair; we fall back to the
// server-supplied href (stripped to a relative path) for the cases mobile
// can't route (react/reply/bookmark/new_post) — on web that href is reliable.
function notificationRoute(notif) {
  const objType = notif?.objectType
  const objId   = notif?.objectId
  if (objType && objId) {
    const enc = encodeURIComponent(objId)
    switch (objType) {
      case 'Post':   return `/posts/${enc}`
      case 'Group':  return notif?.type === 'join_request' ? `/groups/${enc}/pending` : `/groups/${enc}`
      case 'Page':   return `/pages/${enc}`
      case 'Circle': return `/circles/${enc}`
      // Reply / React / Bookmark: fall through to the href fallback below.
      default: break
    }
  }
  // Fallback: the server-generated href, reduced to a same-origin relative path.
  if (typeof notif?.href === 'string') {
    const rel = notif.href.replace(/^https?:\/\/[^/]+/, '')
    if (rel.startsWith('/')) return rel
  }
  return null
}

// Broadcast the current unread count so the header + bottom-tab badges can
// update optimistically instead of waiting for their next 60s poll.
function emitUnread(count) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kowloon:unread', { detail: { count } }))
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

// Renders the notification body using backend-supplied summary + href.
// actorId is used to make the actor name a profile link.
function NotifBody({ notif, onMarkRead }) {
  const actorProfileUrl = `/users/${encodeURIComponent(notif.actorId)}`
  // summary is e.g. "Miles Ahead reacted to your post" — we link the actor name portion
  const actorName = notif.actorName || notif.actorId
  const restOfSummary = notif.summary?.replace(actorName, '').trim()
  const href = typeof notif.href === 'string' ? notif.href.replace(/^https?:\/\/[^/]+/, '') : null

  return (
    <p className="font-ui text-sm text-base-content/80 leading-snug">
      <Link
        to={actorProfileUrl}
        onClick={(e) => { e.stopPropagation(); onMarkRead?.() }}
        className="font-bold hover:text-primary transition-colors"
      >
        {actorName}
      </Link>
      {restOfSummary && <> {restOfSummary}</>}
      {href && (
        <Link
          to={href}
          onClick={(e) => { e.stopPropagation(); onMarkRead?.() }}
          className="block font-reading text-xs text-base-content/60 mt-1 italic hover:text-primary transition-colors"
        >
          {href}
        </Link>
      )}
    </p>
  )
}

function NotifCard({ notif, onActivate, onMarkRead, onDismiss }) {
  // Two independent signals, not one shape doing double duty (Notification.md):
  // a left-edge bar colored by notification type, a small dot for unread --
  // the icon itself stays a single muted ink color on both, so the bar
  // carries the color signal alone.
  const barColor = (NOTIF_COLORS[notif.type] ?? 'text-base-content/60').replace('text-', 'bg-')
  // Build a minimal actor shape for UserAvatar
  const actor = {
    id: notif.actorId,
    username: notif.actorName,
    profile: { icon: notif.actorIcon },
  }

  const activate = () => onActivate(notif)
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate() }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={onKeyDown}
      className={`flex items-stretch gap-3 py-4 pr-2 -mr-2 border-b border-base-300 group cursor-pointer hover:bg-base-200 transition-colors ${notif.read ? 'opacity-60' : ''}`}
    >
      <div className={`w-1 shrink-0 ${barColor}`} aria-hidden="true" />
      <div className="shrink-0 mt-1 text-base-content/50">{NOTIF_ICONS[notif.type] ?? <Bell size={14} />}</div>
      <div className="shrink-0 mt-1"><UserAvatar user={actor} size="sm" /></div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <NotifBody notif={notif} onMarkRead={() => onMarkRead(notif.id)} />
        <Timestamp date={notif.createdAt} />
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notif.read && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead(notif.id) }}
            title="Mark as read"
            className="p-1.5 text-base-content/40 hover:text-primary transition-colors"
          >
            <Check size={13} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(notif.id) }}
          title="Dismiss"
          className="p-1.5 text-base-content/40 hover:text-error transition-colors"
        >
          <X size={13} />
        </button>
      </div>
      {!notif.read && <div className="w-2 h-2 bg-primary shrink-0 mt-2" />}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { t } = useTranslation()
  const client = useClient()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState([])
  const [filter, setFilter]   = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    if (!client) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const res = await client.notifications.list()
      const items = res?.orderedItems ?? res ?? []
      setNotifications(items)
      emitUnread(items.filter((n) => !n.read).length)
    } catch (err) {
      setError(err.message || 'Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => { load() }, [load])

  const markRead = (id) => {
    const next = notifications.map((n) => n.id === id ? { ...n, read: true } : n)
    setNotifications(next)
    emitUnread(next.filter((n) => !n.read).length)
    if (client) client.notifications.markRead(id).catch(() => {})
  }

  const dismiss = (id) => {
    const next = notifications.filter((n) => n.id !== id)
    setNotifications(next)
    emitUnread(next.filter((n) => !n.read).length)
    if (client) client.notifications.dismiss(id).catch(() => {})
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    emitUnread(0)
    if (client) client.notifications.markAllRead().catch(() => {})
  }

  // Tap a row → mark it read (if unread) and jump to its source.
  const activate = (notif) => {
    if (!notif.read) markRead(notif.id)
    const route = notificationRoute(notif)
    if (route) navigate(route)
  }

  const visible = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter)
  const unreadCount = notifications.filter((n) => !n.read).length

  const FILTER_LABELS = {
    all:           t('notif.all',          { defaultValue: 'All' }),
    reply:         t('notif.replies',      { defaultValue: 'Replies' }),
    react:         t('notif.reacts',       { defaultValue: 'Reacts' }),
    new_post:      t('notif.newPosts',     { defaultValue: 'New Posts' }),
    join_request:  t('notif.joinRequests', { defaultValue: 'Join Requests' }),
    join_approved: t('notif.joinApproved', { defaultValue: 'Approved' }),
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between border-b-2 border-base-300 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl tracking-wide leading-none">{t('notif.title', { defaultValue: 'Notifications' })}</h1>
          {unreadCount > 0 && <p className="font-ui text-sm uppercase tracking-widest text-base-content/50">{unreadCount} {t('notif.unread', { defaultValue: 'unread' })}</p>}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1.5 px-4 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary hover:text-primary transition-colors">
            <CheckCheck size={13} /> {t('notif.markAllRead', { defaultValue: 'Mark all read' })}
          </button>
        )}
      </div>

      <div className="flex items-center gap-0 border-b border-base-300 pb-3 flex-wrap">
        {FILTER_TYPES.map((type) => (
          <button key={type} onClick={() => setFilter(type)} className={`flex items-center gap-1.5 px-3 py-2 font-ui text-xs uppercase tracking-widest transition-colors border-r border-base-300 last:border-r-0 ${filter === type ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'}`}>
            {type !== 'all' && <span className={filter === type ? 'text-primary-content' : (NOTIF_COLORS[type] ?? '')}>{NOTIF_ICONS[type]}</span>}
            {FILTER_LABELS[type]}
          </button>
        ))}
      </div>

      {loading && <Spinner centered />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && visible.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-ui text-sm uppercase tracking-widest text-base-content/40">{t('notif.empty', { defaultValue: 'No notifications.' })}</p>
        </div>
      )}
      {!loading && !error && visible.length > 0 && (
        <div className="flex flex-col">
          {visible.map((notif) => (
            <NotifCard
              key={notif.id}
              notif={notif}
              onActivate={activate}
              onMarkRead={markRead}
              onDismiss={dismiss}
            />
          ))}
        </div>
      )}
    </div>
  )
}
