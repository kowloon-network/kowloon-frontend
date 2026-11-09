// useNotificationPoll — ONE shared unread-notifications poller for the whole
// app. Header, BottomTabBar (mounted even when CSS-hidden on desktop) and
// NotificationToaster used to each run their own 60s interval -- 3 requests a
// minute, even in background tabs. Now a single module-level poller runs while
// at least one component is subscribed, keyed on the signed-in user, skips
// ticks while the tab is hidden and refreshes as soon as it becomes visible.
//
// One request serves everyone: GET /notifications?unread=true returns both the
// newest unread items (for toasts) and totalItems (the unread badge count).

import { useEffect, useSyncExternalStore } from 'react'
import { useSelector } from 'react-redux'
import { useClient } from './useClient'

const POLL_MS = 60_000
const EMPTY = { userId: null, count: 0, items: [], fetchedAt: 0 }

let snapshot = EMPTY
let client = null
let userId = null
let timer = null
let refs = 0
const listeners = new Set()

function emit(next) {
  snapshot = next
  listeners.forEach((fn) => fn())
}

async function poll() {
  if (!client || !userId) return
  if (typeof document !== 'undefined' && document.hidden) return
  const forUser = userId
  try {
    const res = await client.notifications.list({ unread: true, limit: 20 })
    if (forUser !== userId) return // user switched mid-request
    const items = res?.orderedItems ?? res?.items ?? []
    emit({ userId: forUser, count: res?.totalItems ?? items.length, items, fetchedAt: Date.now() })
  } catch {
    // Non-fatal -- keep the last known state
  }
}

function onVisible() {
  if (!document.hidden) poll()
}

// NotificationsPage emits this on mark-read/dismiss/mark-all so badges update
// instantly instead of waiting for the next poll.
function onUnreadEvent(e) {
  emit({ ...snapshot, count: e.detail?.count ?? 0 })
}

function start(nextClient, nextUserId) {
  if (client === nextClient && userId === nextUserId && timer) return
  stop()
  client = nextClient
  userId = nextUserId
  emit({ ...EMPTY, userId })
  timer = setInterval(poll, POLL_MS)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('kowloon:unread', onUnreadEvent)
  poll()
}

function stop() {
  if (timer) clearInterval(timer)
  timer = null
  client = null
  userId = null
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('kowloon:unread', onUnreadEvent)
  if (snapshot !== EMPTY) emit(EMPTY)
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const getSnapshot = () => snapshot

/**
 * @returns {{ userId: string|null, count: number, items: Array, fetchedAt: number }}
 *   `items` are the newest unread notifications from the latest poll.
 */
export function useNotificationPoll() {
  const c = useClient()
  const id = useSelector((s) => s.auth.user?.id ?? null)

  useEffect(() => {
    if (!c || !id) return
    refs++
    start(c, id)
    return () => {
      refs--
      if (refs === 0) stop()
    }
  }, [c, id])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
