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
import SafeHtml from '../ui/SafeHtml'
import { SensitiveMedia } from './ContentWarning'
import { ImageRows, HeaderImage } from './PostImages'
import { toLayoutItem, attachmentKind } from '../../lib/postImageItems'
import { useContentWarning } from '../../hooks/useContentWarning'

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
  // Video and audio render their own controls, so the lightbox trigger lives
  // in a corner button to avoid hijacking play/pause taps. (Images render in
  // ImageRows -- see PostImages.jsx.)
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

// Full post page: all of a post's images in rows that keep each image's
// shape (same rules as the feed card, without its 4-item cap); clicking one
// opens the lightbox. Video, audio and other files follow with their own
// players. Mirrors the app's MediaAttachments (mobile PostBody.jsx).
function Attachments({ attachments = [] }) {
  const [lightboxIdx, setLightboxIdx] = useState(null)
  if (!attachments.length) return null

  const images = attachments.filter((a) => attachmentKind(a) === 'image')
  const others = attachments.filter((a) => attachmentKind(a) !== 'image')
  const lightboxItems = attachments.filter(isLightboxable)
  const openLightbox = (a) => {
    const idx = lightboxItems.findIndex((x) => x.url === a.url)
    setLightboxIdx(idx >= 0 ? idx : 0)
  }
  const navigate = (delta) => {
    setLightboxIdx((i) => (i + delta + lightboxItems.length) % lightboxItems.length)
  }

  return (
    <div className="flex flex-col gap-3 mt-3 mb-6">
      {images.length > 0 && (
        <ImageRows
          items={images.map((a) => toLayoutItem(a, 'image'))}
          cellAction={(i) => ({ onClick: () => openLightbox(images[i]) })}
        />
      )}
      {others.map((a, i) => (
        <div key={`${a.url}-${i}`}>
          {renderMediaItem(a, { large: attachmentKind(a) === 'video', onOpen: isLightboxable(a) ? () => openLightbox(a) : null })}
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

// Capped feed-card media grid (Card.md decision 2) -- up to 4 attachments in
// rows that keep each image's shape, cropped around its focus point
// (PostImages.jsx); a 5th+ turns the last cell into a "+N more" link to the
// full post. Video and audio show as tiles here -- full playback lives on
// the post page.
function AttachmentGrid({ attachments = [], postUrl }) {
  if (!attachments.length) return null
  const shown = attachments.slice(0, 4)
  const extra = attachments.length - shown.length

  return (
    <ImageRows
      className="mt-3 mb-3"
      items={shown.map((a) => toLayoutItem(a))}
      // Cards load a downsized variant: 400px for cells sharing a row, 800
      // for an image alone in its row (server falls back to the original
      // when that size doesn't exist).
      srcFor={(it, cellCount) => sizedUrl(it.uri, cellCount > 1 ? 400 : 800)}
      cellAction={() => (postUrl ? { to: postUrl } : null)}
      renderPlaceholder={(it, onMeasure) => (
        <>
          {it.kind === 'video' && (
            <video
              src={it.uri}
              muted
              preload="metadata"
              className="w-full h-full object-cover"
              onLoadedMetadata={onMeasure ? (e) => onMeasure(e.currentTarget.videoWidth, e.currentTarget.videoHeight) : undefined}
            />
          )}
          <span className={`absolute inset-0 flex items-center justify-center ${it.kind === 'video' ? 'bg-black/30' : ''}`}>
            {it.kind === 'video' && <Play size={24} className="text-white" />}
            {it.kind === 'audio' && <Music size={24} className="text-base-content/70" />}
            {it.kind === 'file' && <FileText size={24} className="text-base-content/70" />}
          </span>
        </>
      )}
      renderOverlay={(i) =>
        extra > 0 && i === shown.length - 1 ? (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="font-ui text-sm uppercase tracking-widest text-white">+{extra} more</span>
          </div>
        ) : null
      }
    />
  )
}

export default function PostBody({ post, showFull = false }) {
  const navigate = useNavigate()
  const [heroLightbox, setHeroLightbox] = useState(false)
  // Photos and video marked sensitive stay blurred until tapped (one tap
  // shows every picture in the post).
  const { blurMedia } = useContentWarning(post)
  const [mediaShown, setMediaShown] = useState(false)
  const blur = blurMedia && !mediaShown
  const reveal = () => setMediaShown(true)

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

  // body = pre-rendered HTML from server; fall back to rendering raw markdown for local/mock data.
  // marked passes raw HTML through untouched, so this output is only safe
  // because it is rendered via <SafeHtml> below.
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
  // Cards get a downsized variant (server falls back to the original if that
  // thumbnail doesn't exist); the full post page and the lightbox get full size.
  const heroDisplaySrc = showFull ? heroSrc : sizedUrl(heroSrc, 600)
  // Size + focus point of the header image, for its shape and crop
  // (PostImages.jsx). Only describes featuredImage, not a Link's OG fallback.
  const heroInfo = heroSrc && heroSrc === post?.featuredImage ? post?.featuredImageInfo : undefined

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
        <SensitiveMedia blur={blur} onReveal={reveal} className="mb-6">
          <EmbedPlayer embed={embed} poster={post?.image} title={title} />
        </SensitiveMedia>
      ) : (

      /* Hero image — after title, before body (non-Media types). For Link
          posts the image is a click-through to the external URL (like the title);
          for Article/Event featured images it opens the lightbox. */
      heroSrc && (
        blur ? (
          <SensitiveMedia blur onReveal={reveal} className="mb-6">
            <HeaderImage uri={heroSrc} src={heroDisplaySrc} info={heroInfo} />
          </SensitiveMedia>
        ) : isLink && post?.href ? (
          <a
            href={post.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-6 cursor-pointer"
          >
            <HeaderImage uri={heroSrc} src={heroDisplaySrc} info={heroInfo} alt={title ?? ''} />
          </a>
        ) : (
          <>
            <HeaderImage
              uri={heroSrc}
              src={heroDisplaySrc}
              info={heroInfo}
              alt={title ?? ''}
              onClick={() => setHeroLightbox(true)}
              className="mb-6"
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
        <SensitiveMedia blur={blur} onReveal={reveal}>
          {showFull
            ? <Attachments attachments={post?.attachments ?? []} />
            : <AttachmentGrid attachments={post?.attachments ?? []} postUrl={postUrl} />}
        </SensitiveMedia>
      )}

      {/* SafeHtml: body may come from an arbitrary remote server (ServerPage)
          or from the local marked fallback -- sanitize before injecting. */}
      <SafeHtml
        html={html}
        onClick={handleBodyClick}
        className="prose prose-lg max-w-none [&_h1]:text-xl lg:[&_h1]:text-3xl [&_h1]:mt-0 [&_h1]:mb-3 [&_h2]:text-lg lg:[&_h2]:text-xl [&_h3]:text-base lg:[&_h3]:text-lg"
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
        <SensitiveMedia blur={blur} onReveal={reveal}>
          {showFull
            ? <Attachments attachments={post.attachments} />
            : <AttachmentGrid attachments={post.attachments} postUrl={postUrl} />}
        </SensitiveMedia>
      )}
    </div>
  )
}
