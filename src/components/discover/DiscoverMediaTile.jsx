// DiscoverMediaTile — one media thumbnail in a Discover media shelf / server
// landing strip. Web counterpart of the mobile DiscoverMediaTile.
//   image : thumbnail that links to its post (/posts/:id)
//   video : click opens fullscreen playback in a modal (<video controls autoPlay>)
//   audio : plays inline via the styled AudioPlayer tile
// `mediaKind` + `mediaUrl` + `mediaImage` come from GET /discovery.
// `baseUrl` resolves relative URLs when the tile shows a remote server's media.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Music, Play, X } from 'lucide-react'
import AudioPlayer from '../ui/AudioPlayer'
import sizedUrl from '../../lib/sizedUrl'
import { useCompactWarning } from '../../hooks/useContentWarning'

// Resolve a possibly-relative media URL against a remote base (for cross-server
// tiles). Absolute + data URLs pass through untouched.
function resolveUrl(url, baseUrl) {
  if (!url) return url
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url
  if (!baseUrl) return url
  return `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

// Fullscreen video overlay — autoplays, native controls, click backdrop / X closes.
function FullscreenVideo({ src, onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-5 right-5 z-10 bg-black/55 p-2 text-white hover:text-white/70 transition-colors"
      >
        <X size={22} strokeWidth={2} />
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={src}
        controls
        autoPlay
        playsInline
        onClick={(e) => e.stopPropagation()}
        className="max-w-[92vw] max-h-[88vh] bg-black"
      />
    </div>,
    document.body,
  )
}

function AuthorOverlay({ author, baseUrl }) {
  const icon = resolveUrl(author?.icon, baseUrl)
  return (
    <>
      <div className="absolute inset-x-0 bottom-0 h-9 bg-black/50 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 flex items-center gap-1.5 pointer-events-none">
        {icon
          ? <img src={sizedUrl(icon, 100)} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
          : <div className="w-4 h-4 rounded-full bg-white/30 shrink-0" />}
        <span className="font-ui text-[10px] text-white truncate">{author?.name || author?.id}</span>
      </div>
    </>
  )
}

export default function DiscoverMediaTile({ item, size = 150, baseUrl, showAuthor }) {
  const [videoOpen, setVideoOpen] = useState(false)
  const cw = useCompactWarning(item)
  const kind = item.mediaKind || 'image'
  const img = resolveUrl(item.mediaImage || item.featuredImage, baseUrl)
  const playUrl = resolveUrl(item.mediaUrl, baseUrl)
  const author = item.actor || {}
  const dims = { width: size, height: size }

  // ── Behind a content warning or sensitive: a plain tile that opens the
  // post, where the reader can choose to see it. ──
  if (cw.hideImage) {
    return (
      <Link
        to={`/posts/${encodeURIComponent(item.id)}`}
        style={dims}
        className="shrink-0 relative flex items-center justify-center bg-base-200 overflow-hidden p-2"
      >
        <span className="font-ui text-[10px] uppercase tracking-widest text-base-content/60 text-center line-clamp-4">
          {cw.text || 'Sensitive media'}
        </span>
        {showAuthor && <AuthorOverlay author={author} baseUrl={baseUrl} />}
      </Link>
    )
  }

  // ── Audio — inline styled player fills the tile. ──
  if (kind === 'audio' && playUrl) {
    return (
      <div style={dims} className="shrink-0 relative bg-base-300">
        <AudioPlayer src={playUrl} image={img || undefined} className="w-full h-full" />
      </div>
    )
  }

  // ── Video — click opens fullscreen playback. ──
  if (kind === 'video' && playUrl) {
    return (
      <>
        <button
          type="button"
          onClick={() => setVideoOpen(true)}
          style={dims}
          className="shrink-0 relative block bg-neutral-900 overflow-hidden group"
        >
          {img
            ? <img src={sizedUrl(img, 400)} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full" />}
          <span className="absolute top-1.5 right-1.5 w-[30px] h-[30px] rounded-full bg-black/45 flex items-center justify-center">
            <Play size={14} className="text-white translate-x-px" fill="currentColor" strokeWidth={0} />
          </span>
          {showAuthor && <AuthorOverlay author={author} baseUrl={baseUrl} />}
        </button>
        {videoOpen && <FullscreenVideo src={playUrl} onClose={() => setVideoOpen(false)} />}
      </>
    )
  }

  // ── Image (default) — link to the post. ──
  return (
    <Link
      to={`/posts/${encodeURIComponent(item.id)}`}
      style={dims}
      className="shrink-0 relative block bg-base-300 overflow-hidden"
    >
      {kind === 'image' && img ? (
        <img src={sizedUrl(img, 400)} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-secondary">
          <Music size={24} className="text-secondary-content opacity-80" />
        </div>
      )}
      {showAuthor && <AuthorOverlay author={author} baseUrl={baseUrl} />}
    </Link>
  )
}
