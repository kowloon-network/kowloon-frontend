// Reply — single reply row with author edit/delete and a react button.
//
// Body is a `reading-surface` (kowloon-design/components/Reply.md) — reader-
// controlled typography, same mechanism as PostBody's body/title. Previously
// a fixed text-[13.5px]/leading-[1.45]/font-[450] override that never
// respected the reader's chosen font, size, or line-spacing.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Pen, Trash, Send, X, MessageSquare } from 'lucide-react'
import UserAvatar from '../ui/UserAvatar'
import Timestamp from '../ui/Timestamp'
import ReactButton from './ReactButton'
import { useClient } from '../../hooks/useClient'

// `showReply` gates the threaded-reply affordance — first-level replies only,
// since threading is capped at 2 levels. `onReplyClick` toggles the inline
// composer (owned by PostPage). `replyCount` renders a subtle "N replies" hint.
export default function Reply({ reply, onUpdated, onDeleted, showReply = false, onReplyClick, replyCount = 0 }) {
  const { t } = useTranslation()
  const { user } = useSelector((s) => s.auth)
  const client = useClient()

  const actor = reply.actor ?? {}
  const html = reply.body || reply.source?.content || ''
  const isAuthor = !!user && reply.actorId === user.id

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(reply.source?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async (e) => {
    e?.preventDefault()
    if (!draft.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await client.activities.updateReply({ replyId: reply.id, content: draft })
      const updated = res?.result ?? res?.activity?.object ?? null
      onUpdated?.({
        ...reply,
        source: { ...(reply.source ?? {}), content: draft },
        body: updated?.body ?? '',
      })
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Failed to save reply.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    if (!window.confirm(t('post.deleteReplyConfirm', { defaultValue: 'Delete this reply? This cannot be undone.' }))) return
    setDeleting(true)
    setError(null)
    try {
      await client.activities.deleteReply({ replyId: reply.id })
      onDeleted?.(reply.id)
    } catch (err) {
      setError(err.message || 'Failed to delete reply.')
      setDeleting(false)
    }
  }

  return (
    <div className="flex gap-3 py-5 border-b border-base-300 last:border-b-0">
      <div className="shrink-0">
        <UserAvatar user={actor} size="sm" />
      </div>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            to={`/users/${encodeURIComponent(actor.id ?? '')}`}
            className="font-ui text-sm font-bold text-base-content hover:text-primary transition-colors"
          >
            {actor.name ?? actor.displayName ?? actor.id}
          </Link>
          <Timestamp date={reply.publishedAt ?? reply.createdAt} />
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="flex flex-col gap-2 mt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              className="w-full px-3 py-2 bg-base-100 border-2 border-base-300 focus:border-primary outline-none font-reading text-sm text-base-content resize-none transition-colors"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(e) }}
            />
            <div className="flex items-center justify-end gap-2">
              {error && <span className="font-ui text-xs uppercase tracking-widest text-error mr-auto">{error}</span>}
              <button
                type="button"
                onClick={() => { setEditing(false); setDraft(reply.source?.content ?? ''); setError(null) }}
                className="inline-flex items-center gap-1 px-3 py-1.5 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:text-base-content transition-colors"
              >
                <X size={12} />
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                type="submit"
                disabled={!draft.trim() || saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <Send size={12} />
                {saving ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
              </button>
            </div>
          </form>
        ) : (
          html ? (
            <div className="reading-surface">
              <div
                className="prose prose-sm max-w-none font-reading text-base-content/80"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          ) : null
        )}

        {!editing && (
          <div className="flex items-center gap-4 pt-1 -mb-1">
            {user && (
              <ReactButton post={reply} t={t} />
            )}
            {showReply && user && (
              <button
                type="button"
                onClick={onReplyClick}
                className="inline-flex items-center gap-1 font-ui text-xs uppercase tracking-widest text-base-content/40 hover:text-primary transition-colors"
              >
                <MessageSquare size={13} />
                {t('post.reply', { defaultValue: 'Reply' })}
              </button>
            )}
            {showReply && replyCount > 0 && (
              <span className="font-ui text-xs uppercase tracking-widest text-base-content/40">
                {t('post.threadReplyCount', { count: replyCount, defaultValue: `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` })}
              </span>
            )}
            {isAuthor && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  title={t('common.edit', { defaultValue: 'Edit' })}
                  aria-label={t('common.edit', { defaultValue: 'Edit' })}
                  className="text-sm text-base-content/40 hover:text-base-content transition-colors"
                >
                  <Pen size={13} />
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  title={t('common.delete', { defaultValue: 'Delete' })}
                  aria-label={t('common.delete', { defaultValue: 'Delete' })}
                  className="text-sm text-base-content/40 hover:text-error transition-colors disabled:opacity-30"
                >
                  <Trash size={13} />
                </button>
              </>
            )}
            {error && !editing && (
              <span className="font-ui text-xs uppercase tracking-widest text-error">{error}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
