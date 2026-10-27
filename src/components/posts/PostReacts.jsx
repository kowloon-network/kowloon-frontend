// PostReacts — distinct emoji reactions on a post, sorted by count desc.
// Renders flush-right above the action bar at ~75% body text size. Reads the
// pre-aggregated string from `post.reactSummary` (server-cached); falls back
// to `post.reactPreview` if summary isn't present yet (un-backfilled post).

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import UserAvatar from '../ui/UserAvatar'
import Spinner from '../ui/Spinner'

export default function PostReacts({ post }) {
  const summary = post?.reactSummary || post?.reactPreview
  if (!summary) return null

  const total = post?.reactCount ?? 0

  return (
    <div className="flex justify-end items-center gap-2 pt-2">
      <span
        className="font-reading text-base-content/70 leading-none tracking-[0.35em]"
        style={{ fontSize: '0.75em' }}
        aria-label="Reactions"
      >
        {summary}
      </span>
      {total > 0 && (
        <span
          className="font-ui text-base-content/60 leading-none"
          style={{ fontSize: '0.75em' }}
        >
          {total}
        </span>
      )}
    </div>
  )
}

// ReactCounts — per-emoji breakdown with counts (e.g. 👍 5  ❤️ 2  🤬 12), shown
// on the post detail view. Reads `post.reactCounts` ([{ emoji, count }], server-
// sorted by count desc) which getPost returns. Mirrors mobile's ReactsBar.
//
// Clicking any emoji opens a modal listing who reacted and with what (#63) —
// fetched on demand via client.feeds.getReacts(), not pre-loaded with the post.
export function ReactCounts({ post }) {
  const counts = post?.reactCounts
  const [modalOpen, setModalOpen] = useState(false)
  if (!Array.isArray(counts) || counts.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Reactions">
        {counts.map(({ emoji, count }) => (
          <button
            key={emoji}
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 hover:opacity-70 transition-opacity"
          >
            <span className="text-base leading-none">{emoji}</span>
            <span className="font-ui text-sm text-base-content/60">{count}</span>
          </button>
        ))}
      </div>
      {modalOpen && <ReactorsModal postId={post.id} onClose={() => setModalOpen(false)} />}
    </>
  )
}

// ── Who reacted (#63) ─────────────────────────────────────────────────────────

function ReactorsModal({ postId, onClose }) {
  const client = useClient()
  const [reacts, setReacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    setError(null)
    try {
      const res = await client.feeds.getReacts({ postId })
      setReacts(res?.orderedItems ?? res?.items ?? [])
    } catch (err) {
      setError(err.message || 'Failed to load reactions.')
    } finally {
      setLoading(false)
    }
  }, [client, postId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 bg-black/50 z-[80]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reactions"
        className="fixed inset-x-2 top-4 h-[calc(100svh-2rem)] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-12 sm:bottom-12 sm:h-auto sm:max-h-[calc(100svh-6rem)] sm:w-full sm:max-w-md bg-base-100 border-2 border-secondary z-[90] flex flex-col"
      >
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b-2 border-base-300 bg-secondary text-secondary-content">
          <span className="font-display text-lg tracking-wide">Reactions</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-secondary-content/60 hover:text-secondary-content transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-2">
          {loading ? (
            <div className="py-8 flex justify-center"><Spinner /></div>
          ) : error ? (
            <p className="py-8 text-center font-ui text-xs text-error">{error}</p>
          ) : reacts.length === 0 ? (
            <p className="py-8 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">
              No reactions yet.
            </p>
          ) : (
            reacts.map((r) => (
              <Link
                key={r.id}
                to={`/users/${encodeURIComponent(r.actorId)}`}
                onClick={onClose}
                className="flex items-center gap-3 py-3 border-b border-base-300 last:border-b-0 hover:bg-base-200/50 transition-colors -mx-2 px-2"
              >
                <UserAvatar user={r.actor ?? { id: r.actorId }} size="sm" />
                <span className="flex-1 min-w-0 font-ui text-sm text-base-content truncate">
                  {r.actor?.name ?? r.actor?.username ?? r.actorId}
                </span>
                <span className="text-lg leading-none shrink-0">{r.emoji}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
