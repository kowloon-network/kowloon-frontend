// PostPage — single post view with full content, actions, and replies.

import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useClient } from '../hooks/useClient'
import PostCard from '../components/posts/PostCard'
import { ReactCounts } from '../components/posts/PostReacts'
import Reply from '../components/posts/Reply'
import ReplyComposer from '../components/posts/ReplyComposer'
import MorePostsByAuthor from '../components/posts/MorePostsByAuthor'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'
import { buildReplyTree } from '../lib/replyTree'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PostPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const client = useClient()
  const { t } = useTranslation()
  const user = useSelector((state) => state.auth.user)

  // `?focusReply=1` auto-focuses the composer on load (set by "Reply"
  // affordances on feed cards), mirroring mobile's focusReply.
  const [searchParams] = useSearchParams()
  const focusReply = searchParams.get('focusReply')
  const shouldFocusReply = focusReply === '1' || focusReply === 'true'

  const [post, setPost]       = useState(null)
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  // Which first-level reply currently has its inline threaded composer open.
  const [openReplyId, setOpenReplyId] = useState(null)

  const repliesEndRef = useRef(null)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    setError(null)
    try {
      const [postRes, repliesRes] = await Promise.all([
        client.feeds.getPost({ postId: id }),
        client.feeds.getReplies({ postId: id }).catch(() => null),
      ])
      setPost(postRes)
      setReplies(repliesRes?.orderedItems ?? repliesRes?.items ?? [])
    } catch (err) {
      setError(err.message || 'Failed to load post.')
    } finally {
      setLoading(false)
    }
  }, [client, id])

  useEffect(() => { load() }, [load])

  // Reconcile the replies list with the server WITHOUT flipping `loading` (a
  // full load() collapses the page to a spinner and scrolls to the top). The
  // read path lags the write, so a just-posted reply may not be queryable yet
  // (#66) — keep any still-pending optimistic replies the server list doesn't
  // yet contain, matched by author + raw content.
  const reconcileReplies = useCallback(async () => {
    if (!client || !id) return
    try {
      const res = await client.feeds.getReplies({ postId: id })
      const server = res?.orderedItems ?? res?.items ?? []
      const contentOf = (r) => {
        const raw = r?.source?.content
        if (typeof raw === 'string' && raw.length) return raw.trim()
        return String(r?.body || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      }
      setReplies((prev) => {
        const seen = new Set(server.map((r) => `${r.actorId}|${contentOf(r)}`))
        const stillPending = prev.filter(
          (r) => r.__optimistic && !seen.has(`${r.actorId}|${contentOf(r)}`),
        )
        return [...server, ...stillPending]
      })
    } catch {
      // keep the existing replies on a transient error
    }
  }, [client, id])

  // Insert the just-posted reply optimistically, then reconcile a couple of
  // times to absorb the read-lag window. Does NOT call load(), so the page
  // stays put instead of collapsing to a spinner.
  const handleReplySubmitted = useCallback(({ duplicated, content, inReplyTo }) => {
    if (duplicated) return
    const optimistic = {
      id: `pending-${Date.now()}`,
      __optimistic: true,
      actorId: user?.id,
      actor: {
        id: user?.id,
        name: user?.profile?.name ?? user?.name,
        icon: user?.profile?.icon ?? user?.icon,
      },
      // Slot into the tree: threaded replies hang off the first-level reply
      // (inReplyTo); top-level replies hang off the post. Root target is always
      // the post. Use the canonical post.id (what server replies carry) so the
      // optimistic row buckets alongside the reconciled ones.
      target: post?.id ?? id,
      parent: inReplyTo ?? post?.id ?? id,
      source: { content },
      body: '',
      publishedAt: new Date().toISOString(),
    }
    setReplies((arr) => [...arr, optimistic])
    setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
    setTimeout(() => reconcileReplies(), 800)
    setTimeout(() => reconcileReplies(), 2500)
  }, [user, reconcileReplies, id, post])

  const rootId = post?.id ?? id
  const tree = useMemo(() => buildReplyTree(replies, rootId), [replies, rootId])

  if (loading) return <Spinner centered />
  if (error)   return <ErrorState message={error} onRetry={load} />
  if (!post)   return null

  const updateReply = (next) => setReplies((arr) => arr.map((r) => (r.id === next.id ? next : r)))
  const removeReply = (rid) => setReplies((arr) => arr.filter((r) => r.id !== rid))

  return (
    <div className="flex flex-col gap-8">

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-base-content/65 hover:text-primary transition-colors self-start"
      >
        <ArrowLeft size={13} /> {t('common.back', { defaultValue: 'Back' })}
      </button>

      <PostCard post={post} onDeleted={() => navigate(-1)} showFull />

      <ReactCounts post={post} />

      <div className="flex flex-col gap-0" id="replies">
        <div className="flex items-center justify-between border-b-2 border-base-300 pb-4 mb-2">
          <h2 className="font-display text-2xl tracking-wide">
            {t('post.replyCount', { count: replies.length, defaultValue: `${replies.length} replies` })}
          </h2>
        </div>

        {tree.length > 0 ? (
          <div className="border-b border-base-300">
            {tree.map(({ reply, children }) => {
              const composerOpen = openReplyId === reply.id
              return (
                <div key={reply.id}>
                  <Reply
                    reply={reply}
                    onUpdated={updateReply}
                    onDeleted={removeReply}
                    showReply={post.canReply !== '@none'}
                    replyCount={reply.replyCount ?? 0}
                    onReplyClick={() => setOpenReplyId(composerOpen ? null : reply.id)}
                  />

                  {(children.length > 0 || composerOpen) && (
                    <div className="ml-6 md:ml-11 pl-4 border-l-2 border-base-300">
                      {children.map((child) => (
                        <Reply
                          key={child.id}
                          reply={child}
                          onUpdated={updateReply}
                          onDeleted={removeReply}
                          showReply={false}
                        />
                      ))}

                      {composerOpen && (
                        <ReplyComposer
                          postId={rootId}
                          inReplyTo={reply.id}
                          parent={reply.contentWarning ? reply : post}
                          canReply={post.canReply}
                          autoFocus
                          compact
                          placeholder={t('post.threadReplyPlaceholder', {
                            name: reply.actor?.name ?? reply.actor?.id,
                            defaultValue: `Reply to ${reply.actor?.name ?? 'this reply'}…`,
                          })}
                          onCancel={() => setOpenReplyId(null)}
                          onSubmitted={(payload) => {
                            handleReplySubmitted(payload)
                            setOpenReplyId(null)
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="font-ui text-sm text-base-content/40 py-6">
            {t('post.noReplies', { defaultValue: 'No replies yet. Be the first.' })}
          </p>
        )}

        <div ref={repliesEndRef} />

        <ReplyComposer
          postId={id}
          parent={post}
          canReply={post.canReply}
          autoFocus={shouldFocusReply}
          onSubmitted={handleReplySubmitted}
        />
      </div>

      <MorePostsByAuthor post={post} />

    </div>
  )
}
