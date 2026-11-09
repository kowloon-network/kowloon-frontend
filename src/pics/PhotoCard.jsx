// PhotoCard — one grid cell in the pics.<domain> photo grid. The photo is a
// full-bleed CSS background (not <img>) so the author/title/action overlay
// can sit directly on top of it. Clicking the card body opens the lightbox
// at this exact photo; the react/share icons act immediately in place.

import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import ReactButton from '../components/posts/ReactButton'
import { ShareButton, ReplyButton } from '../components/posts/PostToolbar'
import UserAvatar from '../components/ui/UserAvatar'
import sizedUrl from '../lib/sizedUrl'

export default function PhotoCard({ post, attachment, photoCount = 1, onOpen }) {
  const { t } = useTranslation()
  const user = useSelector((state) => state.auth.user)

  const author = post?.actor
  const authorName = author?.name ?? author?.id ?? post?.actorId
  const authorHandle = author?.id ?? post?.actorId
  // A multi-photo post doesn't have one "the" image title — the post's own
  // title/summary describes the whole set better than a single attachment's
  // (possibly blank) caption. Single-photo posts still prefer the photo's
  // own caption when it has one.
  const isMultiPhoto = photoCount > 1
  const title = isMultiPhoto
    ? (post?.title || post?.summary || '')
    : (attachment?.name || attachment?.alt || post?.title || post?.name || '')
  const bgUrl = sizedUrl(attachment?.url, 600)
  const mainDomain = window.location.hostname.replace(/^pics\./, '')

  return (
    <div
      className="relative aspect-square overflow-hidden bg-base-300 cursor-pointer group"
      style={{ backgroundImage: bgUrl ? `url(${bgUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.() } }}
      aria-label={title || t('pics.openPhoto', { defaultValue: 'Open photo' })}
    >
      {/* Bottom tinted overlay — avatar + name/id/title (left) + react/share (right), white on a dark scrim */}
      <div
        className="absolute inset-x-0 bottom-0 px-2.5 py-2 flex items-center justify-between gap-2"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0) 80%)' }}
      >
        {/* Photo-count badge — sits directly above this bar, on the image itself */}
        {photoCount > 1 && (
          <span
            className="absolute right-2 bottom-full mb-1.5 w-5 h-5 rounded-full bg-black/60 text-white font-ui text-[10px] font-medium flex items-center justify-center"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
          >
            {photoCount}
          </span>
        )}

        <div className="min-w-0 flex items-center gap-2">
          <UserAvatar user={author} size="sm" />
          <div className="min-w-0 flex flex-col leading-tight">
            <span className="font-ui text-[11px] font-medium text-white truncate">{authorName}</span>
            <span className="font-ui text-[10px] text-white/75 truncate">{authorHandle}</span>
            {title && <span className="font-ui text-[10px] text-white/75 truncate">{title}</span>}
          </div>
        </div>
        {/* Hidden on phone — too cramped alongside the avatar/name/id/title
            block at that width; the react/reply/share row still fits fine on
            tablet and desktop. React count already lives on ReactButton
            itself, so there's no separate "preview" element to duplicate it. */}
        <div
          className="hidden sm:flex items-center gap-2.5 shrink-0 [&_button]:text-white [&_button:hover]:text-white/70 [&_svg]:drop-shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <ReplyButton
            post={post}
            t={t}
            onClick={() => {
              window.location.href = `${window.location.protocol}//${mainDomain}/posts/${encodeURIComponent(post.id)}`
            }}
          />
          {user && post?.canReact !== 'none' && <ReactButton post={post} t={t} />}
          <ShareButton post={post} t={t} user={user} />
        </div>
      </div>
    </div>
  )
}
