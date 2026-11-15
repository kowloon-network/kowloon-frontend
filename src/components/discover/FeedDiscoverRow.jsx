// FeedDiscoverRow — a single horizontally-scrolling row of square cards pulled
// from the same curated pool as the Discover page (GET /discovery). Shown
// at the top of the Community Posts feed only. Mixed content: Posts (media +
// text), Circles, Groups, Pages, Bookmarks, Servers — one uniform square each.
//
// Prototype: flattens every discovery section into one deduped, capped row.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Newspaper, Users, Globe, Bookmark as BookmarkIcon, FileText } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import CircleIcon from '../ui/CircleIcon'
import sizedUrl from '../../lib/sizedUrl'
import { useCompactWarning } from '../../hooks/useContentWarning'

const SQUARE = 168
const MAX = 18

const hexMask = {
  WebkitMaskImage: 'url(/hex-mask.svg)',
  maskImage: 'url(/hex-mask.svg)',
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
}

function HexAvatar({ url, type, size = 40 }) {
  return url
    ? <img src={sizedUrl(url, 200)} alt="" className="object-cover shrink-0" style={{ width: size, height: size, ...hexMask }} />
    : <div className="bg-secondary flex items-center justify-center shrink-0" style={{ width: size, height: size, ...hexMask }}>
        <CircleIcon type={type} size="md" className="text-secondary-content opacity-70" />
      </div>
}

const squareCls = 'shrink-0 overflow-hidden bg-base-100 border border-base-300 hover:border-primary transition-colors'
const sq = { width: SQUARE, height: SQUARE }

// A post. Behind a content warning (or with sensitive media) it drops the
// picture and shows the warning instead of its words.
function PostSquare({ item }) {
  const cw = useCompactWarning(item)
  const img = cw.hideImage ? null : (item.featuredImage || item.mediaImage)
  return img ? <PostImageCard item={item} img={img} /> : <PostTextCard item={item} warning={cw.text} />
}

// A media/featured-image post: image fills the square, author overlaid on a scrim.
function PostImageCard({ item, img }) {
  const author = item.actor || {}
  const text = item.title || item.summary || item.preview || ''
  return (
    <Link to={`/posts/${encodeURIComponent(item.id)}`} className={`${squareCls} relative block bg-base-300`} style={sq}>
      <img src={sizedUrl(img, 400)} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-2.5">
        {text && <p className="font-ui text-[11px] font-bold text-white leading-snug line-clamp-2">{text}</p>}
        <div className="flex items-center gap-1.5 mt-1.5">
          {author.icon
            ? <img src={sizedUrl(author.icon, 100)} alt="" className="w-4 h-4 rounded-full object-cover" />
            : <div className="w-4 h-4 rounded-full bg-white/30" />}
          <span className="font-ui text-[10px] text-white/90 truncate">{author.name || author.id}</span>
        </div>
      </div>
    </Link>
  )
}

// A text post: type label, as much preview as fits, author at the foot.
function PostTextCard({ item, warning }) {
  const author = item.actor || {}
  const text = warning || item.title || item.summary || item.preview || ''
  return (
    <Link to={`/posts/${encodeURIComponent(item.id)}`} className={`${squareCls} flex flex-col p-3`} style={sq}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Newspaper size={11} className="text-base-content/40" />
        <span className="font-ui uppercase tracking-widest text-[9px] text-base-content/45">{item.type || 'Post'}</span>
      </div>
      <p className="font-ui text-[11px] leading-snug text-base-content line-clamp-5 flex-1">{text}</p>
      <div className="flex items-center gap-1.5 mt-2">
        {author.icon
          ? <img src={sizedUrl(author.icon, 100)} alt="" className="w-4 h-4 rounded-full object-cover" />
          : <div className="w-4 h-4 rounded-full bg-base-300" />}
        <span className="font-ui text-[10px] text-base-content/60 truncate">{author.name || author.id}</span>
      </div>
    </Link>
  )
}

function EntityCard({ item, to, type }) {
  const blurb = item.summary || item.description
  return (
    <Link to={to} className={`${squareCls} flex flex-col p-3`} style={sq}>
      <HexAvatar url={item.icon} type={type} size={40} />
      <span className="font-ui text-sm font-bold truncate mt-2 text-base-content">{item.name}</span>
      {typeof item.memberCount === 'number' && item.memberCount > 0 && (
        <span className="font-ui text-[10px] uppercase tracking-widest text-base-content/45 mt-0.5">
          {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
        </span>
      )}
      {blurb && <p className="font-ui text-[11px] leading-snug text-base-content/70 line-clamp-3 mt-1">{blurb}</p>}
    </Link>
  )
}

function LinkySquare({ item, to, href, Icon }) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={11} className="text-base-content/40" />
        <span className="font-ui uppercase tracking-widest text-[9px] text-base-content/45">{item.refType}</span>
      </div>
      <p className="font-ui text-sm font-bold leading-snug line-clamp-2 text-base-content">{item.title || item.name}</p>
      {item.summary && <p className="font-ui text-[11px] leading-snug text-base-content/70 line-clamp-3 mt-1">{item.summary}</p>}
    </>
  )
  const cls = `${squareCls} flex flex-col p-3`
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={sq}>{inner}</a>
    : <Link to={to} className={cls} style={sq}>{inner}</Link>
}

function SquareCard({ item }) {
  switch (item.refType) {
    case 'Post': return <PostSquare item={item} />
    case 'Circle': return <EntityCard item={item} to={`/circles/${encodeURIComponent(item.id)}`} type="circle" />
    case 'Group':  return <EntityCard item={item} to={`/groups/${encodeURIComponent(item.id)}`} type="group" />
    case 'Page':   return <LinkySquare item={item} to={`/pages/${encodeURIComponent(item.id)}`} Icon={FileText} />
    case 'Bookmark': return <LinkySquare item={item} href={item.href} Icon={BookmarkIcon} />
    case 'Server': return <LinkySquare item={item} to={`/server/${encodeURIComponent(item.domain)}`} Icon={Globe} />
    default: return null
  }
}

export default function FeedDiscoverRow({ refreshKey = 0 }) {
  const client = useClient()
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!client) return
    let cancelled = false
    client.feeds.getDiscovery()
      .then((res) => {
        if (cancelled) return
        const seen = new Set()
        const flat = []
        for (const section of res?.sections ?? []) {
          for (const it of section?.items ?? []) {
            const k = `${it.refType}:${it.id}`
            if (seen.has(k)) continue
            seen.add(k)
            flat.push(it)
          }
        }
        // Shuffle so object types are mixed, not clustered by curated section,
        // and the cap samples across the whole pool.
        for (let i = flat.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[flat[i], flat[j]] = [flat[j], flat[i]]
        }
        setItems(flat.slice(0, MAX))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [client, refreshKey])

  if (items.length === 0) return null

  return (
    <div className="mb-5 -mt-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg tracking-wide leading-none">Discover</h2>
        <Link to="/discover" className="flex items-center gap-0.5 font-ui text-[10px] uppercase tracking-widest text-base-content/50 hover:text-primary transition-colors">
          See all <ChevronRight size={12} />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {items.map((item, i) => <SquareCard key={`${item.refType}:${item.id}:${i}`} item={item} />)}
      </div>
    </div>
  )
}
