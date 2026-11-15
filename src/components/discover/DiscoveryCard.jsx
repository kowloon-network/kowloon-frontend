// DiscoveryCard — one Discover item, dispatched by refType. Web counterpart
// of the mobile DiscoveryCard.
//   Post          : featured-image card with author + title overlay (text fallback)
//   Circle        : icon + name + blurb, with View / Save (copy) actions
//   Group         : icon + name + blurb, with View / Posts actions
//   Bookmark/Page : compact link card
//   Server        : icon + name + domain + blurb, links to /server/:domain
//
// Cards are fixed-width so they sit in a horizontally scrolling shelf. `onDark`
// styles them for the blurred-hero Discover background; `baseUrl` resolves
// relative image URLs when the shelf shows a remote server's content.

import { Link } from 'react-router-dom'
import { Bookmark as BookmarkIcon, ExternalLink, Globe, Newspaper, Users } from 'lucide-react'
import CircleIcon from '../ui/CircleIcon'
import CopyCircleMenu from '../circles/CopyCircleMenu'
import sizedUrl from '../../lib/sizedUrl'
import { useCompactWarning } from '../../hooks/useContentWarning'

const CARD_W = 'w-60'   // 240px — circles/groups/links/servers
const POST_W = 'w-72'   // 288px — posts

// Editorial-commentary strip under a Post card. Always the same height,
// whether or not there's a note, so cards in the same shelf stay level
// regardless of which posts happen to be curated.
const NOTE_BLOCK_HEIGHT = 64

function NoteBlock({ note }) {
  return (
    <div className="bg-black px-3 py-2.5 flex items-center" style={{ minHeight: NOTE_BLOCK_HEIGHT }}>
      {note && (
        <p className="font-ui text-xs text-white/80 leading-relaxed line-clamp-3">{note}</p>
      )}
    </div>
  )
}

const hexMask = {
  WebkitMaskImage: 'url(/hex-mask.svg)',
  maskImage: 'url(/hex-mask.svg)',
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
}

// Resolve a possibly-relative image URL against a remote base (cross-server shelves).
function resolveUrl(url, baseUrl) {
  if (!url) return url
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url
  if (!baseUrl) return url
  return `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

function HexAvatar({ url, type, size = 40 }) {
  if (url) {
    return <img src={sizedUrl(url, 200)} alt="" className="object-cover shrink-0" style={{ width: size, height: size, ...hexMask }} />
  }
  return (
    <div className="bg-secondary flex items-center justify-center shrink-0" style={{ width: size, height: size, ...hexMask }}>
      <CircleIcon type={type} size="md" className="text-secondary-content opacity-70" />
    </div>
  )
}

// Panel + text tokens shared by the entity/link/server cards.
function tokens(onDark) {
  return {
    panel: onDark ? 'bg-black/40 border border-white/10' : 'bg-base-100 border border-base-300',
    title: onDark ? 'text-white' : 'text-base-content',
    meta:  onDark ? 'text-white/50' : 'text-base-content/45',
    blurb: onDark ? 'text-white/75' : 'text-base-content/70',
    btn:   onDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-base-200 hover:bg-base-300 text-base-content',
  }
}

function PostCard({ item, baseUrl, onDark }) {
  // Content warning: no picture, and the warning instead of the post's words.
  const cw = useCompactWarning(item)
  const img = cw.hideImage ? null : resolveUrl(item.featuredImage, baseUrl)
  const author = item.actor || {}
  const authorIcon = resolveUrl(author.icon, baseUrl)
  const text = cw.text || item.title || item.summary || item.preview || ''
  if (img) {
    return (
      <Link to={`/posts/${encodeURIComponent(item.id)}`} className={`${POST_W} shrink-0 block bg-base-300 overflow-hidden`}>
        <div className="relative" style={{ height: 168 }}>
          <img src={sizedUrl(img, 600)} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="font-ui text-sm font-bold text-white leading-snug line-clamp-2">{text}</p>
            <div className="flex items-center gap-2 mt-2">
              {authorIcon
                ? <img src={sizedUrl(authorIcon, 100)} alt="" className="w-5 h-5 rounded-full object-cover" />
                : <div className="w-5 h-5 rounded-full bg-white/30" />}
              <span className="font-ui text-[11px] text-white/90 truncate">{author.name || author.id}</span>
            </div>
          </div>
        </div>
        <NoteBlock note={item.note} />
      </Link>
    )
  }
  const t = tokens(onDark)
  return (
    <Link to={`/posts/${encodeURIComponent(item.id)}`} className={`${CARD_W} shrink-0 block ${onDark ? 'bg-black/40' : 'bg-base-200'}`}>
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Newspaper size={12} className={t.meta} />
          <span className={`font-ui uppercase tracking-widest text-[9px] ${t.meta}`}>{item.type || 'Post'}</span>
        </div>
        <p className={`font-ui text-sm font-bold leading-snug line-clamp-4 ${t.title}`}>{text}</p>
        <div className="flex items-center gap-2 mt-3">
          {authorIcon
            ? <img src={sizedUrl(authorIcon, 100)} alt="" className="w-5 h-5 rounded-full object-cover" />
            : <div className={`w-5 h-5 rounded-full ${onDark ? 'bg-white/20' : 'bg-base-300'}`} />}
          <span className={`font-ui text-[11px] truncate ${t.blurb}`}>{author.name || author.id}</span>
        </div>
      </div>
      <NoteBlock note={item.note} />
    </Link>
  )
}

function CircleCard({ item, baseUrl, onDark }) {
  const t = tokens(onDark)
  const blurb = item.summary || item.description
  const to = `/circles/${encodeURIComponent(item.id)}`
  return (
    <div className={`${CARD_W} shrink-0 p-3 flex flex-col ${t.panel}`}>
      <div className="flex items-center gap-3">
        <HexAvatar url={resolveUrl(item.icon, baseUrl)} type="circle" size={40} />
        <div className="flex flex-col min-w-0 flex-1">
          <span className={`font-ui text-sm font-bold truncate ${t.title}`}>{item.name}</span>
          {typeof item.memberCount === 'number' && item.memberCount > 0 && (
            <span className={`font-ui text-[10px] uppercase tracking-widest mt-0.5 ${t.meta}`}>
              {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
            </span>
          )}
        </div>
      </div>
      {blurb && <p className={`font-ui text-xs leading-relaxed mt-2 line-clamp-2 ${t.blurb}`}>{blurb}</p>}
      <div className="flex gap-2 mt-3 items-stretch">
        <Link to={to} className={`flex-1 text-center px-2 py-2 font-ui uppercase tracking-widest text-[10px] transition-colors ${t.btn}`}>
          View
        </Link>
        {/* Save = copy this circle into your own (reuses the app-wide CopyCircleMenu).
            Light chip so its default dark label stays legible on the dark panel. */}
        <CopyCircleMenu circle={item} className={onDark ? 'bg-base-100' : ''} />
      </div>
    </div>
  )
}

function GroupCard({ item, baseUrl, onDark }) {
  const t = tokens(onDark)
  const blurb = item.summary
  return (
    <div className={`${CARD_W} shrink-0 p-3 flex flex-col ${t.panel}`}>
      <div className="flex items-center gap-3">
        <HexAvatar url={resolveUrl(item.icon, baseUrl)} type="group" size={40} />
        <div className="flex flex-col min-w-0 flex-1">
          <span className={`font-ui text-sm font-bold truncate ${t.title}`}>{item.name}</span>
          {typeof item.memberCount === 'number' && item.memberCount > 0 && (
            <span className={`font-ui text-[10px] uppercase tracking-widest mt-0.5 ${t.meta}`}>
              {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
            </span>
          )}
        </div>
      </div>
      {blurb && <p className={`font-ui text-xs leading-relaxed mt-2 line-clamp-2 ${t.blurb}`}>{blurb}</p>}
      <div className="flex gap-2 mt-3">
        <Link to={`/groups/${encodeURIComponent(item.id)}`} className={`flex-1 text-center px-2 py-2 font-ui uppercase tracking-widest text-[10px] transition-colors ${t.btn}`}>
          View
        </Link>
        <Link to={`/groups/${encodeURIComponent(item.id)}/posts`} className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 font-ui uppercase tracking-widest text-[10px] transition-colors ${t.btn}`}>
          <Users size={11} /> Posts
        </Link>
      </div>
    </div>
  )
}

function LinkCard({ item, baseUrl, to, href, icon, onDark }) {
  const t = tokens(onDark)
  const img = resolveUrl(item.image, baseUrl)
  const inner = (
    <>
      {img && <img src={sizedUrl(img, 400)} alt="" className="w-full object-cover" style={{ height: 110 }} />}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          {icon}
          <span className={`font-ui uppercase tracking-widest text-[9px] ${t.meta}`}>{item.refType}</span>
        </div>
        <p className={`font-ui text-sm font-bold leading-snug line-clamp-2 ${t.title}`}>{item.title || item.name}</p>
        {item.summary && <p className={`font-ui text-xs leading-relaxed mt-1 line-clamp-2 ${t.blurb}`}>{item.summary}</p>}
      </div>
    </>
  )
  const cls = `${CARD_W} shrink-0 block overflow-hidden ${t.panel}`
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <Link to={to} className={cls}>{inner}</Link>
}

function ServerCard({ item, baseUrl, onDark }) {
  const t = tokens(onDark)
  const icon = resolveUrl(item.icon, baseUrl)
  return (
    <div className={`${CARD_W} shrink-0 p-3 flex flex-col ${t.panel}`}>
      <div className="flex items-center gap-3">
        {icon
          ? <img src={sizedUrl(icon, 200)} alt="" className="w-10 h-10 object-cover shrink-0 bg-base-200" />
          : <div className="w-10 h-10 bg-secondary flex items-center justify-center shrink-0">
              <Globe size={20} className="text-secondary-content opacity-75" />
            </div>}
        <div className="flex flex-col min-w-0 flex-1">
          <span className={`font-ui text-sm font-bold truncate ${t.title}`}>{item.name || item.domain}</span>
          <span className={`font-ui text-[10px] uppercase tracking-widest mt-0.5 truncate ${t.meta}`}>
            {item.domain}
            {typeof item.userCount === 'number' ? `  ·  ${item.userCount.toLocaleString()} users` : ''}
          </span>
        </div>
      </div>
      {item.description && <p className={`font-ui text-xs leading-relaxed mt-2 line-clamp-2 ${t.blurb}`}>{item.description}</p>}
      <div className="flex gap-2 mt-3">
        <Link to={`/server/${encodeURIComponent(item.domain)}`} className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 font-ui uppercase tracking-widest text-[10px] transition-colors ${t.btn}`}>
          <Globe size={11} /> Visit
        </Link>
      </div>
    </div>
  )
}

export default function DiscoveryCard({ item, baseUrl, onDark }) {
  const meta = onDark ? 'text-white/50' : 'text-base-content/50'
  switch (item.refType) {
    case 'Post':
      return <PostCard item={item} baseUrl={baseUrl} onDark={onDark} />
    case 'Circle':
      return <CircleCard item={item} baseUrl={baseUrl} onDark={onDark} />
    case 'Group':
      return <GroupCard item={item} baseUrl={baseUrl} onDark={onDark} />
    case 'Bookmark':
      return <LinkCard item={item} baseUrl={baseUrl} href={item.href} onDark={onDark} icon={<BookmarkIcon size={12} className={meta} />} />
    case 'Page':
      return <LinkCard item={item} baseUrl={baseUrl} to={`/pages/${encodeURIComponent(item.id)}`} onDark={onDark} icon={<ExternalLink size={12} className={meta} />} />
    case 'Server':
      return <ServerCard item={item} baseUrl={baseUrl} onDark={onDark} />
    default:
      return null
  }
}
