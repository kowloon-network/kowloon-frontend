// NotificationToaster.jsx
// Shows discreet slide-in toasts for new notifications, fed by the shared
// poller in hooks/useNotificationPoll (one request/min, paused in hidden tabs).
// First poll baselines existing unread IDs so we never toast on page load.
// Renders via createPortal to avoid clipping from any ancestor overflow:hidden.

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { MessageSquare, Heart, UserPlus, Bell, Users, X } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { useNotificationPoll } from '../../hooks/useNotificationPoll'

const TOAST_MS    = 6000   // auto-dismiss after 6 seconds
const MAX_VISIBLE = 3      // cap toasts on screen at once

const TYPE_ICON = {
  reply:         MessageSquare,
  react:         Heart,
  follow:        UserPlus,
  new_post:      Bell,
  join_request:  Users,
  join_approved: Users,
}

const TYPE_ACCENT = {
  reply:         'bg-primary',
  react:         'bg-error',
  follow:        'bg-success',
  new_post:      'bg-base-content/40',
  join_request:  'bg-secondary',
  join_approved: 'bg-secondary',
}

// ── Single toast ──────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  const navigate  = useNavigate()
  const client    = useClient()
  const [pct, setPct] = useState(100)
  const rafRef    = useRef()
  const startRef  = useRef(Date.now())

  // Animate the progress bar and auto-dismiss when it reaches 0
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const next = Math.max(0, 100 - (elapsed / TOAST_MS) * 100)
      setPct(next)
      if (next > 0) rafRef.current = requestAnimationFrame(tick)
      else onDismiss(toast.id)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [toast.id, onDismiss])

  const Icon   = TYPE_ICON[toast.type]   ?? Bell
  const accent = TYPE_ACCENT[toast.type] ?? 'bg-base-content/40'

  const handleClick = () => {
    onDismiss(toast.id)
    // Mark read silently — non-fatal if it fails
    client?.notifications?.markRead(toast.id).catch(() => {})
    if (toast.href) navigate(toast.href)
  }

  return (
    <div
      role="alert"
      onClick={handleClick}
      className="relative w-72 bg-base-100 border border-base-300 shadow-lg overflow-hidden cursor-pointer"
      style={{ animation: 'kowloon-toast-slide-in 180ms ease-out both' }}
    >
      {/* Type accent — thin left stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${accent}`} aria-hidden="true" />

      <div className="flex items-start gap-3 pl-4 pr-3 py-3">
        <Icon size={13} className="shrink-0 mt-0.5 text-base-content/50" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-ui text-xs font-semibold text-base-content leading-tight truncate">
            {toast.actorName}
          </p>
          <p className="font-ui text-xs text-base-content/55 leading-snug mt-0.5 line-clamp-2">
            {toast.summary}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(toast.id) }}
          aria-label="Dismiss notification"
          className="shrink-0 p-0.5 -mr-0.5 text-base-content/25 hover:text-base-content/70 transition-colors"
        >
          <X size={11} />
        </button>
      </div>

      {/* Progress bar — drains left to right over TOAST_MS */}
      <div
        aria-hidden="true"
        className={`absolute bottom-0 left-0 h-px ${accent} opacity-40`}
        style={{ width: `${pct}%`, transition: 'none' }}
      />
    </div>
  )
}

// ── Toast queue + poll ────────────────────────────────────────────────────────

export default function NotificationToaster() {
  const user          = useSelector((s) => s.auth.user)
  const toastsEnabled = useSelector((s) => s.auth.user?.prefs?.notifications?.toasts ?? true)
  const poll          = useNotificationPoll()
  const [toasts, setToasts] = useState([])
  const seenIds   = useRef(new Set())
  const baselined = useRef(null) // userId the seen-set was baselined for

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (!poll.fetchedAt || !poll.userId) return
    const items = poll.items

    if (baselined.current !== poll.userId) {
      // First poll for this user: snapshot existing unread IDs so we don't
      // toast them on page load.
      seenIds.current = new Set(items.map((n) => n.id))
      baselined.current = poll.userId
      return
    }

    const fresh = items.filter((n) => !seenIds.current.has(n.id))
    if (fresh.length === 0) return
    fresh.forEach((n) => seenIds.current.add(n.id))
    if (!toastsEnabled) return

    setToasts((prev) => {
      const incoming = fresh.slice(0, MAX_VISIBLE).map((n) => ({
        id:        n.id,
        type:      n.type,
        actorName: n.actorName ?? n.actor?.name ?? 'Someone',
        summary:   n.summary  ?? '',
        href:      n.href     ?? null,
      }))
      // Newest at front; cap total visible
      return [...incoming, ...prev].slice(0, MAX_VISIBLE)
    })
  }, [poll, toastsEnabled])

  if (!user || toasts.length === 0) return null

  return createPortal(
    <div
      role="region"
      aria-label="Incoming notifications"
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-5 right-5 z-[200] flex flex-col-reverse gap-2 pointer-events-none"
    >
      <style>{`
        @keyframes kowloon-toast-slide-in {
          from { opacity: 0; transform: translateX(10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>,
    document.body
  )
}
