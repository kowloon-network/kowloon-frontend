// PostBody — renders post content.
// Handles type-specific rendering: linked titles for Link posts, media attachments for Media posts.
// Props: post object

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Link2, Play, Music, FileText, Maximize2, MapPin } from 'lucide-react'
import { marked } from 'marked'
import { resolveEmbed } from '@kowloon/client'
import AudioPlayer from '../ui/AudioPlayer'
import MediaLightbox from '../ui/MediaLightbox'
import EmbedPlayer from './EmbedPlayer'
import UserAvatar from '../ui/UserAvatar'
import sizedUrl from '../../lib/sizedUrl'

marked.use({ breaks: true, gfm: true })

function LinkTitle({ post }) {
  const href = post.href
  let domain = null
  if (href) {
    try { domain = new URL(href).hostname.replace(/^www\./, '') } catch {}
  }
  const targetActor = post.targetActor

  const inner = (
    <span className="inline-flex items-center gap-2">
      <Link2 size={28} className="shrink-0 opacity-50" />
      {post.name}
    </span>
  )

  return (
    <div className="mb-3">
      <h1 className="font-display text-2xl lg:text-5xl mb-3">
        {href
          ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">{inner}</a>
          : inner
        }
      </h1>
      {/* Credit the ORIGINAL author when this Link is sharing another Kowloon
          post (#44) — links to their profile. Falls back to the bare
          (domain) for a plain external link, or an old share made before
          targetActor existed. */}
      {targetActor ? (
        <Link
          to={`/users/${encodeURIComponent(targetActor.id)}`}
          className="inline-flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity"
        >
          <UserAvatar user={targetActor} size="sm" />
          <span className="font-ui text-base font-medium text-base-content">{targetActor.name ?? targetActor.id}</span>
          {/* No (domain) here — it's redundant, already inside the handle. */}
          <span className="font-ui text-xs text-base-content/55 dark:text-base-content/70">{targetActor.id}</span>
        </Link>
      ) : domain ? (
        <p className="font-ui text-sm uppercase tracking-widest text-base-content/60 mb-3">({domain})</p>
      ) : null}
    </div>
  )
}


// Geotag display — a small pin + place-name line. Rendered on Note/Article/
// Media/Link posts (Events render their own prominent location in EventCard).
function LocationLine({ location }) {
  const name = location?.name
  if (!name) return null
  return (
    <div className="flex items-center gap-1.5 mb-4">
      <MapPin size={13} className="shrink-0 text-base-content/55" />
      <span className="font-ui text-xs uppercase tracking-widest text-base-content/55 truncate">
        {name}
      </span>
    </div>
  )
}

// Route a Kowloon-item href to its in-app SPA path, or null if it's an external
// link that should open normally. Mirrors mobile's openKowloonLink: posts /
// circles / groups / users carry self-identifying prefixed IDs (works for any
// server), so those route in-app regardless of host; pages use human slugs, so
// we only treat same-origin /pages/ links as in-app.
function kowloonRouteFromHref(href) {
  if (!href) return null
  let url
  try { url = new URL(href, window.location.origin) } catch { return null }
  let path = url.pathname
  try { path = decodeURIComponent(path) } catch { /* keep raw on malformed input */ }
  const sameOrigin = url.origin === window.location.origin
  let m
  if ((m = path.match(/^\/posts\/(post:[^/?#]+@[^/?#]+)/)))     return `/posts/${encodeURIComponent(m[1])}`
  if ((m = path.match(/^\/groups\/(group:[^/?#]+@[^/?#]+)/)))   return `/groups/${encodeURIComponent(m[1])}`
  if ((m = path.match(/^\/circles\/(circle:[^/?#]+@[^/?#]+)/))) return `/circles/${encodeURIComponent(m[1])}`
  if ((m = path.match(/^\/users\/(@[^/?#]+)/)))                 return `/users/${encodeURIComponent(m[1])}`
  // Same-origin links to any of our own SPA routes (pages, or non-prefixed ids).
  if (sameOrigin && (m = path.match(/^\/(posts|circles|groups|users|pages)\/([^/?#]+)/))) {
    return `/${m[1]}/${encodeURIComponent(m[2])}`
  }
  return null
}

// True for media types where a fullscreen lightbox makes sense.
function isLightboxable(a) {
  const mt = a?.mediaType ?? ''
  return mt.startsWith('image/') || mt.startsWith('video/') || mt.startsWith('audio/')
}

function ExpandButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Expand"
      className="absolute top-2 right-2 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded transition-colors"
    >
      <Maximize2 size={16} />
    </button>
  )
}

function renderMediaItem(a, { large = false, onOpen = null } = {}) {
  const mt = a?.mediaType ?? ''
  if (mt.startsWith('image/')) {
    // Show the image at its native aspect, only cropping when it's awkwardly
    // tall: object-cover + a max-height cap means landscapes and mild portraits
    // render whole, and a very tall portrait is capped and cropped (mirrors the
    // app's imageDisplayRatio 3:4 floor). The lightbox shows the native aspect.
    return (
      <img
        src={a.url}
        alt={a.name ?? ''}
        onClick={onOpen ?? undefined}
        className={`w-full object-cover bg-black ${large ? 'max-h-[32rem]' : 'max-h-96'}${onOpen ? ' cursor-zoom-in' : ''}`}
      />
    )
  }
  // Video and audio render their own controls, so the lightbox trigger lives
  // in a corner button to avoid hijacking play/pause taps.
  if (mt.startsWith('audio/')) {
    return (
      <div className="relative">
        {onOpen && <ExpandButton onClick={onOpen} />}
        <AudioPlayer src={a.url} className="w-full aspect-video" />
      </div>
    )
  }
  if (mt.startsWith('video/')) {
    return (
      <div className={`relative ${large ? 'w-full aspect-video bg-black overflow-hidden' : ''}`}>
        {onOpen && <ExpandButton onClick={onOpen} />}
        <video controls playsInline className={large ? 'absolute inset-0 w-full h-full object-cover' : 'w-full max-h-[28rem] object-contain bg-black'}>
          <source src={a.url} type={mt} />
        </video>
      </div>
    )
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-ui text-xs uppercase tracking-widest text-primary hover:opacity-80"
    >
      {a.name ?? a.url}
    </a>
  )
}

function MediaThumb({ attachment, active, onClick }) {
  const mt = attachment?.mediaType ?? ''
  const isImage = mt.startsWith('image/')
  const isVideo = mt.startsWith('video/')
  const isAudio = mt.startsWith('audio/')

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={attachment.name ?? 'Media'}
      className={`relative w-full aspect-square overflow-hidden bg-base-300 transition-opacity ${
        active ? 'ring-2 ring-primary opacity-100' : 'opacity-60 hover:opacity-100'
      }`}
    >
      {isImage && <img loading="lazy" src={sizedUrl(attachment.url, 200)} alt={attachment.name ?? ''} className="w-full h-full object-cover" />}
      {isVideo && (
        <>
          <video src={attachment.url} muted preload="metadata" className="w-full h-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Play size={20} className="text-white" />
          </span>
        </>
      )}
      {isAudio && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Music size={22} className="text-base-content/70" />
        </span>
      )}
      {!isImage && !isVideo && !isAudio && (
        <span className="absolute inset-0 flex items-center justify-center">
          <FileText size={22} className="text-base-content/70" />
        </span>
      )}
    </button>
  )
}

function MediaGallery({ attachments }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [lightboxIdx, setLightboxIdx] = useState(null)
  if (!attachments?.length) return null
  const safeActive = Math.min(activeIdx, attachments.length - 1)
  const active = attachments[safeActive]

  // Lightbox cycles through only the items that make sense to enlarge.
  const lightboxItems = attachments.filter(isLightboxable)

  const openLightbox = () => {
    if (!isLightboxable(active)) return
    const idx = lightboxItems.findIndex((a) => a.url === active.url)
    setLightboxIdx(idx >= 0 ? idx : 0)
  }
  const navigate = (delta) => {
    setLightboxIdx((i) => (i + delta + lightboxItems.length) % lightboxItems.length)
  }

  return (
    <div className="flex flex-col gap-3 mt-3 mb-6">
      <div>
        {renderMediaItem(active, { large: true, onOpen: isLightboxable(active) ? openLightbox : null })}
      </div>
      {attachments.length > 1 && (
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(64px,1fr))]">
          {attachments.map((a, i) => (
            <MediaThumb key={i} attachment={a} active={i === safeActive} onClick={() => setActiveIdx(i)} />
          ))}
        </div>
      )}
      {lightboxIdx !== null && (
        <MediaLightbox
          items={lightboxItems}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNavigate={navigate}
        />
      )}
    </div>
  )
}

function Attachments({ attachments = [] }) {
  const [lightboxIdx, setLightboxIdx] = useState(null)
  if (!attachments.length) return null

  const lightboxItems = attachments.filter(isLightboxable)
  const openLightbox = (a) => {
    const idx = lightboxItems.findIndex((x) => x.url === a.url)
    setLightboxIdx(idx >= 0 ? idx : 0)
  }
  const navigate = (delta) => {
    setLightboxIdx((i) => (i + delta + lightboxItems.length) % lightboxItems.length)
  }

  return (
    <div className="flex flex-col gap-2 mt-3">
      {attachments.map((a, i) => (
        <div key={i}>
          {renderMediaItem(a, { onOpen: isLightboxable(a) ? () => openLightbox(a) : null })}
        </div>
      ))}
      {lightboxIdx !== null && (
        <MediaLightbox
          items={lightboxItems}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNavigate={navigate}
        />
      )}
    </div>
  )
}

// Capped feed-card media grid (Card.md decision 2) — up to 4 attachments in
// a 2x2 grid (1 shown full-width); a 5th+ replaces the last cell with a
// "+N more" link to the full post. Images, video, and audio share the same
// cap and cell treatment here — the richer main+thumbnail-strip gallery
// (MediaGallery) and per-item players (Attachments) are reserved for the
// full post detail page (showFull), which this doesn't touch.
function AttachmentGrid({ attachments = [], postUrl }) {
  if (!attachments.length) return null
  const shown = attachments.slice(0, 4)
  const extra = attachments.length - shown.length
  const cols = shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2'

  return (
    <div className={`grid ${cols} gap-1 mt-3 mb-3`}>
      {shown.map((a, i) => {
        const isOverflowCell = i === shown.length - 1 && extra > 0
        // An odd, uncapped final item spans both columns so the grid's
        // bottom edge stays flush instead of leaving an empty cell beside
        // it — matches mobile's existing 2-col grid behavior.
        const isOddFinal = !isOverflowCell && shown.length > 1 && shown.length % 2 === 1 && i === shown.length - 1
        const mt = a?.mediaType ?? ''
        const isImage = mt.startsWith('image/')
        const isVideo = mt.startsWith('video/')
        const isAudio = mt.startsWith('audio/')
        const cell = (
          <div className={`relative overflow-hidden bg-base-300 ${isOddFinal ? 'col-span-2 aspect-[2/1]' : 'aspect-square'}`}>
            {isImage && (
              <img loading="lazy" src={sizedUrl(a.url, 400)} alt={a.name ?? ''} className="w-full h-full object-cover" />
            )}
            {isVideo && (
              <>
                <video src={a.url} muted preload="metadata" className="w-full h-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play size={24} className="text-white" />
                </span>
              </>
            )}
            {isAudio && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Music size={24} className="text-base-content/70" />
              </span>
            )}
            {!isImage && !isVideo && !isAudio && (
              <span className="absolute inset-0 flex items-center justify-center">
                <FileText size={24} className="text-base-content/70" />
              </span>
            )}
            {isOverflowCell && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="font-ui text-sm uppercase tracking-widest text-white">+{extra} more</span>
              </div>
            )}
          </div>
        )
        return postUrl
          ? <Link key={i} to={postUrl}>{cell}</Link>
          : <div key={i}>{cell}</div>
      })}
    </div>
  )
}

export default function PostBody({ post, showFull = false }) {
  const navigate = useNavigate()
  const [heroLightbox, setHeroLightbox] = useState(false)

  // Intercept clicks on links inside the server-rendered HTML body: @mentions
  // and Kowloon-item links navigate in-app (SPA) instead of triggering a full
  // page reload; external links keep their default behaviour.
  function handleBodyClick(e) {
    // Only plain left-clicks — let modified clicks (open-in-new-tab) through.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const anchor = e.target.closest?.('a[href]')
    if (!anchor) return
    const route = kowloonRouteFromHref(anchor.getAttribute('href'))
    if (route) {
      e.preventDefault()
      navigate(route)
    }
  }

  // body = pre-rendered HTML from server; fall back to rendering raw markdown for local/mock data
  const rawSource = post?.source?.content ?? (typeof post?.source === 'string' ? post.source : null) ?? post?.content ?? ''
  const fullHtml = post?.body ?? (rawSource ? marked.parse(rawSource) : '')
  const isTruncated = !showFull && !!post?.summary
  const html = isTruncated ? post.summary : fullHtml
  const title = post?.title ?? post?.name
  const isLink   = post?.type === 'Link'
  const isMedia  = post?.type === 'Media'
  const postUrl  = post?.id ? `/posts/${encodeURIComponent(post.id)}` : null
  const titleLinksToPost = ['Article', 'Media'].includes(post?.type)

  // Rich-media embed (YouTube, …) derived from the link URL at render time via
  // the shared recognizer — never from user markup. Only inline-capable
  // providers replace the static hero with a player.
  const embed = isLink && post?.href ? resolveEmbed(post.href) : null

  // Hero image: featuredImage for non-Media types only. Media posts have no
  // separate "cover" — the attachments themselves are the content (rendered
  // below as a gallery).
  const heroSrc = !isMedia
    ? (post?.featuredImage ?? (isLink ? post?.image : null))
    : null

  return (
    <div className="reading-surface font-reading text-base-content leading-relaxed">
      {title && (
        isLink
          ? <LinkTitle post={{ ...post, name: title }} />
          : <h1 className="font-display text-2xl lg:text-5xl mt-4 mb-8">
              {titleLinksToPost && postUrl
                ? <Link to={postUrl} className="hover:text-primary transition-colors">{title}</Link>
                : title
              }
            </h1>
      )}

      {/* Location — pin + place name (Events show theirs in EventCard) */}
      <LocationLine location={post?.location} />

      {/* Rich-media embed (video, audio, …) takes the featured-media slot when a
          provider recognizes the link; otherwise fall back to the hero image. */}
      {embed?.mode === 'inline' ? (
        <EmbedPlayer embed={embed} poster={post?.image} title={title} />
      ) : (

      /* Hero image — after title, before body (non-Media types). For Link
          posts the image is a click-through to the external URL (like the title);
          for Article/Event featured images it opens the lightbox. */
      heroSrc && (
        isLink && post?.href ? (
          <a
            href={post.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-6"
          >
            <img
              src={heroSrc}
              alt={title ?? ''}
              className="w-full object-cover max-h-64 cursor-pointer"
            />
          </a>
        ) : (
          <>
            <img
              src={heroSrc}
              alt={title ?? ''}
              onClick={() => setHeroLightbox(true)}
              className="w-full object-cover mb-6 cursor-zoom-in max-h-[28rem]"
            />
            {heroLightbox && (
              <MediaLightbox
                items={[{ url: heroSrc, mediaType: 'image/', name: title }]}
                index={0}
                onClose={() => setHeroLightbox(false)}
                onNavigate={() => {}}
              />
            )}
          </>
        )
      )
      )}

      {/* Media: capped grid in the feed card, full gallery on the detail page */}
      {isMedia && (
        showFull
          ? <MediaGallery attachments={post?.attachments ?? []} />
          : <AttachmentGrid attachments={post?.attachments ?? []} postUrl={postUrl} />
      )}

      <div
        onClick={handleBodyClick}
        className="prose prose-lg max-w-none [&_h1]:text-xl lg:[&_h1]:text-3xl [&_h1]:mt-0 [&_h1]:mb-3 [&_h2]:text-lg lg:[&_h2]:text-xl [&_h3]:text-base lg:[&_h3]:text-lg"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {isTruncated && postUrl && (
        <div className="flex justify-end mt-4">
          <Link
            to={postUrl}
            className="font-reading italic text-base-content/50 hover:text-primary transition-colors"
          >
            Continue Reading&hellip;
          </Link>
        </div>
      )}

      {!isMedia && (post?.attachments?.length ?? 0) > 0 && (
        showFull
          ? <Attachments attachments={post.attachments} />
          : <AttachmentGrid attachments={post.attachments} postUrl={postUrl} />
      )}
    </div>
  )
}
