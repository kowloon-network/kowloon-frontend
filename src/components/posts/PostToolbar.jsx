// PostToolbar — react, reply, bookmark, and share actions for a post.
// Auth-aware: shows actions only when appropriate.
// Props: post object

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComment, faBookmark, faShareNodes } from '@fortawesome/free-solid-svg-icons'
import {
  MoreHorizontal, Flag, Ban, BellOff, Link as LinkIcon,
  Copy, ExternalLink, Pencil, Trash2, Compass,
} from 'lucide-react'
import PostComposer from './PostComposer'
import ReactButton from './ReactButton'
import ReplyModal from './ReplyModal'
import BookmarkComposer from '../bookmarks/BookmarkComposer'
import AddToDiscoveryModal from '../discover/AddToDiscoveryModal'
import { useClient } from '../../hooks/useClient'
import { toast } from '../../app/toast'

// ── Share helpers ────────────────────────────────────────────────────────────

function buildShareTitle(post) {
  if (post.title ?? post.name) return post.title ?? post.name
  if (post.textPreview) return post.textPreview
  const actor = post.actor?.id ?? post.actorId ?? 'unknown'
  const date = new Date(post.published ?? post.createdAt ?? Date.now())
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC'
  return `${actor} — ${time}`
}

function buildShareContent(post) {
  // Use source markdown if available, else body text stripped of HTML, else summary
  const raw = post.source?.content
    ?? (post.body ? post.body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null)
    ?? post.summary
    ?? post.content
    ?? ''

  if (!raw) return ''

  const words = raw.trim().split(/\s+/).filter(Boolean)
  const excerpt = words.length <= 100
    ? raw.trim()
    : words.slice(0, 100).join(' ') + '\u2026'

  // Wrap in a Markdown blockquote
  return excerpt.split('\n').map((line) => `> ${line}`).join('\n')
}

function isPublicPost(post) {
  return (
    post.to === '@public' ||
    post.to === 'public' ||
    post.visibility === 'Public' ||
    post.visibility === 'public'
  )
}

// Audience tier of a post, for gating reshares (#47), mirroring mobile's
// PostActionBar:
//   "public"     → @public: reshareable anywhere.
//   "server"     → @<domain>: reshareable only to the server community.
//   "restricted" → a circle/group/self address: not reshareable at all.
function postAudienceTier(post) {
  if (isPublicPost(post)) return 'public'
  const to = String(post?.to ?? '').trim()
  if (to.startsWith('circle:') || to.startsWith('group:')) return 'restricted'
  // @user@domain (two @s) = addressed to a specific user (self / private).
  if (/^@[^@\s]+@[^@\s]+$/.test(to)) return 'restricted'
  // @domain (single @, not @public) = server / community.
  if (/^@[a-z0-9.-]+$/i.test(to)) return 'server'
  return 'restricted' // unknown addressing → fail closed
}

// ── ShareButton ──────────────────────────────────────────────────────────────

export function ShareButton({ post, t, user }) {
  const [sharing, setSharing] = useState(false)

  if (!user) return null

  const postUrl = post.url ?? (post.id ? `/posts/${encodeURIComponent(post.id)}` : null)
  if (!postUrl) return null

  const tier = postAudienceTier(post)

  // Circle/group/user-addressed posts can't be reshared at all (a reshare must
  // never leak a post to a wider audience than the original, #47). Render the
  // icon disabled + tooltip so users see the constraint rather than a missing
  // button.
  if (tier === 'restricted') {
    return (
      <button
        type="button"
        disabled
        title={t('post.reshareRestricted', { defaultValue: "Shared with a specific circle \u2014 can't be reshared" })}
        aria-label={t('post.reshareRestricted', { defaultValue: "Shared with a specific circle \u2014 can't be reshared" })}
        className="text-base text-base-content/20 cursor-not-allowed"
      >
        <FontAwesomeIcon icon={faShareNodes} />
      </button>
    )
  }

  const firstImageAttachment = post.attachments?.find(
    (a) => typeof a?.mediaType === 'string' && a.mediaType.startsWith('image/'),
  )

  // Public posts reshare to anyone; server-only posts cap the reshare audience
  // to the server community so the reshare can't be widened to Public (#47).
  const reshareAudience = tier === 'server' ? 'server' : 'public'

  const initialValues = {
    type: 'Link',
    href: postUrl,
    title: buildShareTitle(post),
    content: buildShareContent(post),
    featuredImage:
      post.featuredImage ?? post.image ?? firstImageAttachment?.url ?? null,
    tags: ['kowloon'],
    target: post.id ?? null,
    to: reshareAudience,
    // Constraint carried through to the composer's audience picker (matches
    // mobile's `constrain` param) so a Community post can't be widened.
    ...(tier === 'server' ? { constrain: 'server' } : {}),
  }

  return (
    <>
      <button
        onClick={() => setSharing(true)}
        title={t('post.share')}
        aria-label={t('post.share')}
        className="text-base text-base-content/50 hover:text-base-content transition-colors"
      >
        <FontAwesomeIcon icon={faShareNodes} />
      </button>
      {sharing && (
        <PostComposer
          defaultOpen
          initialValues={initialValues}
          onClose={() => setSharing(false)}
          onPostCreated={() => setSharing(false)}
          prompt={t('composer.sharePrompt', { defaultValue: 'Share this post\u2026' })}
        />
      )}
    </>
  )
}

// ── ReplyButton ──────────────────────────────────────────────────────────────
// Extracted so standalone surfaces (the pics grid card) can drop in the same
// reply icon without pulling in the rest of the toolbar. `onClick` decides
// what "reply" means for the caller — PostToolbar opens ReplyModal inline by
// default, but a caller can override it (e.g. jump to the real post page).

export function ReplyButton({ post, t, onClick, replyCount = 0 }) {
  if (!post?.id) return null
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('post.reply', { defaultValue: 'Reply' })}
      aria-label={t('post.reply', { defaultValue: 'Reply' })}
      className="inline-flex items-center gap-1.5 text-base text-base-content/50 hover:text-base-content transition-colors"
    >
      <FontAwesomeIcon icon={faComment} />
      {replyCount > 0 && (
        <span className="font-ui text-xs tracking-wider">{replyCount}</span>
      )}
    </button>
  )
}

// ── Post text extraction (for Copy text) ─────────────────────────────────────

// Prefer the Markdown source; fall back to stripping the rendered HTML. Mirrors
// mobile PostMoreMenu.handleCopyText.
function extractPostText(post) {
  const raw = post?.source?.content ?? post?.textPreview ?? post?.body ?? ''
  return String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

async function copyToClipboard(text) {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ── PostMoreMenu ─────────────────────────────────────────────────────────────
// Ellipsis overflow menu — safety + utility actions, mirroring mobile's
// PostMoreMenu.jsx. Owner Edit/Delete live here too. Rendered through a portal
// (post cards clip overflow) anchored below-right of the trigger.

function PostMoreMenu({ post, t, user, onDeleted }) {
  const client = useClient()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [anchorRect, setAnchorRect] = useState(null)
  const [discoveryOpen, setDiscoveryOpen] = useState(false)

  const triggerRef = useRef(null)
  const popoverRef = useRef(null)

  const authorId = post?.actor?.id ?? post?.actorId ?? null
  const isOwner = !!user?.id && !!authorId && user.id === authorId
  const isSelf = isOwner
  const canReport = !!user
  // Admins and moderators can feature posts on Discover.
  const isAdmin = !!(user?.isServerAdmin || user?.isServerMod)

  const localUrl = post?.id
    ? `${window.location.origin}/posts/${encodeURIComponent(post.id)}`
    : null
  const openUrl = post?.url ?? localUrl
  const postText = extractPostText(post)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (popoverRef.current?.contains(e.target)) return
      if (triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) setAnchorRect(rect)
    }
    setOpen((v) => !v)
  }

  const authorName = post?.actor?.name ?? authorId ?? t('post.thisUser', { defaultValue: 'this user' })

  const handleEdit = () => {
    setOpen(false)
    if (post?.id) navigate(`/posts/${encodeURIComponent(post.id)}/edit`)
  }

  const handleDelete = async () => {
    setOpen(false)
    if (!window.confirm(t('post.deleteConfirm', { defaultValue: 'Delete this post? This cannot be undone.' }))) return
    setDeleting(true)
    try {
      await client.activities.deletePost({ postId: post.id })
      if (onDeleted) onDeleted(post.id)
      else navigate(-1)
    } catch (err) {
      setDeleting(false)
      toast.error(t('post.deleteFailed', { defaultValue: 'Delete failed' }), { detail: err?.message })
    }
  }

  const handleFlag = async () => {
    setOpen(false)
    const reason = window.prompt(t('post.flagPrompt', { defaultValue: 'Why are you reporting this post?' }))
    if (!reason || !reason.trim()) return
    try {
      await client.activities.flag({ targetId: post.id, reason: reason.trim() })
      toast.success(t('post.flagged', { defaultValue: 'Reported — a moderator will review this post.' }))
    } catch (err) {
      toast.error(t('post.flagFailed', { defaultValue: "Couldn't report" }), { detail: err?.message })
    }
  }

  const handleBlock = async () => {
    setOpen(false)
    if (!window.confirm(t('user.blockConfirm', { defaultValue: `Block ${authorName}? They'll be removed from your circles and can't interact with you.` }))) return
    try {
      await client.activities.block({ userId: authorId })
      toast.success(t('user.blocked', { defaultValue: `${authorName} blocked` }))
    } catch (err) {
      toast.error(t('user.blockFailed', { defaultValue: 'Block failed' }), { detail: err?.message })
    }
  }

  const handleMute = async () => {
    setOpen(false)
    if (!window.confirm(t('user.muteConfirm', { defaultValue: `Mute ${authorName}? Their posts won't appear in your feeds.` }))) return
    try {
      await client.activities.mute({ userId: authorId })
      toast.success(t('user.muted', { defaultValue: `${authorName} muted` }))
    } catch (err) {
      toast.error(t('user.muteFailed', { defaultValue: 'Mute failed' }), { detail: err?.message })
    }
  }

  const handleCopyLink = async () => {
    setOpen(false)
    if (!localUrl) return
    const ok = await copyToClipboard(localUrl)
    if (ok) toast.success(t('post.linkCopied', { defaultValue: 'Link copied' }))
  }

  const handleCopyText = async () => {
    setOpen(false)
    if (!postText) return
    const ok = await copyToClipboard(postText)
    if (ok) toast.success(t('post.textCopied', { defaultValue: 'Text copied' }))
  }

  const handleOpenBrowser = () => {
    setOpen(false)
    if (!openUrl) return
    window.open(openUrl, '_blank', 'noopener,noreferrer')
  }

  // Build the item list (with separators), mirroring mobile.
  const items = []

  if (isOwner) {
    items.push({ key: 'edit', Icon: Pencil, label: t('common.edit', { defaultValue: 'Edit' }), onClick: handleEdit })
    items.push({ key: 'delete', Icon: Trash2, label: t('common.delete', { defaultValue: 'Delete' }), danger: true, disabled: deleting, onClick: handleDelete })
  }

  if (canReport) {
    if (items.length) items.push({ key: 'sep1', sep: true })
    items.push({ key: 'flag', Icon: Flag, label: t('post.report', { defaultValue: 'Report' }), onClick: handleFlag })
    if (!isSelf && authorId) {
      items.push({ key: 'block', Icon: Ban, label: t('user.blockAuthor', { defaultValue: 'Block author' }), onClick: handleBlock })
      items.push({ key: 'mute', Icon: BellOff, label: t('user.muteAuthor', { defaultValue: 'Mute author' }), onClick: handleMute })
    }
  }

  if (postText) {
    if (items.some((i) => !i.sep)) items.push({ key: 'septext', sep: true })
    items.push({ key: 'copytext', Icon: Copy, label: t('post.copyText', { defaultValue: 'Copy text' }), onClick: handleCopyText })
  }

  if (localUrl) {
    if (items.some((i) => !i.sep)) items.push({ key: 'sep2', sep: true })
    items.push({ key: 'copylink', Icon: LinkIcon, label: t('post.copyLink', { defaultValue: 'Copy link' }), onClick: handleCopyLink })
  }
  if (openUrl) {
    items.push({ key: 'browser', Icon: ExternalLink, label: t('post.openInBrowser', { defaultValue: 'Open in browser' }), onClick: handleOpenBrowser })
  }

  if (isAdmin && post?.id) {
    items.push({ key: 'sepdiscover', sep: true })
    items.push({
      key: 'discover',
      Icon: Compass,
      label: t('discovery.addTitle', { defaultValue: 'Add to Discovery' }),
      onClick: () => { setOpen(false); setDiscoveryOpen(true) },
    })
  }

  // Nothing actionable — don't render the trigger.
  if (!items.some((i) => !i.sep)) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('post.moreActions', { defaultValue: 'More options' })}
        aria-label={t('post.moreActions', { defaultValue: 'More options' })}
        className="text-base text-base-content/50 hover:text-base-content transition-colors"
      >
        <MoreHorizontal size={18} />
      </button>

      {open && anchorRect && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          className="fixed z-[200] min-w-52 bg-base-100 border-2 border-base-300 shadow-lg flex flex-col"
          style={{
            top: anchorRect.bottom + 4,
            left: Math.max(8, Math.min(anchorRect.right - 208, window.innerWidth - 216)),
          }}
        >
          {items.map((item) =>
            item.sep ? (
              <div key={item.key} className="border-t border-base-300" />
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={item.onClick}
                disabled={item.disabled}
                className={`flex items-center gap-3 px-4 py-2.5 text-left font-ui text-xs uppercase tracking-widest transition-colors hover:bg-base-200 disabled:opacity-40 ${item.danger ? 'text-error' : 'text-base-content'}`}
              >
                <item.Icon size={14} className={item.danger ? 'text-error' : 'text-base-content/50'} />
                {item.label}
              </button>
            ),
          )}
        </div>,
        document.body,
      )}

      {isAdmin && (
        <AddToDiscoveryModal
          item={post}
          refType="Post"
          open={discoveryOpen}
          onClose={() => setDiscoveryOpen(false)}
        />
      )}
    </>
  )
}

// ── PostToolbar ──────────────────────────────────────────────────────────────

export default function PostToolbar({ post, onDeleted, onReplyClick }) {
  const user = useSelector((state) => state.auth.user)
  const { t } = useTranslation()
  const [bookmarking, setBookmarking] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyOffset, setReplyOffset] = useState(0)

  const postUrl = post?.url ?? (post?.id ? `/posts/${encodeURIComponent(post.id)}` : null)
  const bookmarkInitial = postUrl ? {
    href: postUrl,
    title: post?.title ?? post?.name ?? undefined,
    image: post?.image ?? post?.featuredImage ?? undefined,
  } : null

  const displayedReplyCount = (post?.replyCount ?? 0) + replyOffset

  return (
    <div className="flex items-center gap-4 flex-1">
      {/* Right cluster: actions */}
      <div className="flex items-center ml-auto">
        <div className="flex items-center gap-4">
        {/* Reply */}
        <ReplyButton
          post={post}
          t={t}
          replyCount={displayedReplyCount}
          onClick={() => (onReplyClick ? onReplyClick() : setReplyOpen(true))}
        />
        {post?.id && !onReplyClick && (
          <ReplyModal
            post={post}
            open={replyOpen}
            onClose={() => setReplyOpen(false)}
            onReplied={({ delta = 1 } = {}) => setReplyOffset((n) => n + delta)}
          />
        )}

        {/* React */}
        {user && post?.canReact !== 'none' && (
          <ReactButton post={post} t={t} />
        )}

        {/* Bookmark */}
        {user && bookmarkInitial && (
          <>
            <button
              onClick={() => setBookmarking(true)}
              title={t('post.bookmark')}
              aria-label={t('post.bookmark')}
              className="text-base text-base-content/50 hover:text-base-content transition-colors"
            >
              <FontAwesomeIcon icon={faBookmark} />
            </button>
            {bookmarking && (
              <BookmarkComposer
                initialValues={bookmarkInitial}
                onClose={() => setBookmarking(false)}
              />
            )}
          </>
        )}

        {/* Share */}
        <ShareButton post={post} t={t} user={user} />

        {/* Overflow menu — report / block / mute / copy / open + owner edit/delete */}
        <PostMoreMenu post={post} t={t} user={user} onDeleted={onDeleted} />
        </div>
      </div>
    </div>
  )
}
