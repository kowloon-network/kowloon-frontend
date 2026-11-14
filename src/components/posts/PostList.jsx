// PostList — renders a list of PostCards, or a media grid when only Media is filtered.
// Props: posts (array), loading, error, hasMore, loadingMore, onLoadMore

import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PostCard from './PostCard'
import Spinner from '../ui/Spinner'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import LoadMoreButton from '../ui/LoadMoreButton'
import { Play } from 'lucide-react'
import sizedUrl from '../../lib/sizedUrl'

// ── Media grid ────────────────────────────────────────────────────────────────

function MediaThumb({ post }) {
  const att = post.attachments?.[0]
  const mt  = att?.mediaType ?? ''

  let thumb = null

  if (mt.startsWith('image/')) {
    thumb = <img loading="lazy" src={sizedUrl(att.url, 400)} alt={att.alt || post.name || ''} className="absolute inset-0 w-full h-full object-cover" />
  } else if (mt.startsWith('video/')) {
    thumb = (
      <>
        <video src={att.url} className="absolute inset-0 w-full h-full object-cover" muted preload="metadata" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 bg-black/50 flex items-center justify-center">
            <span className="text-white text-xl leading-none ml-0.5">&#9654;</span>
          </div>
        </div>
      </>
    )
  } else if (mt.startsWith('audio/')) {
    const bg = post.featuredImage ?? post.image ?? null
    thumb = (
      <>
        {bg
          ? <img loading="lazy" src={sizedUrl(bg, 400)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 bg-base-300" />
        }
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Play className="w-8 h-8 text-white translate-x-0.5" />
        </div>
      </>
    )
  } else {
    // No attachment — solid color placeholder
    thumb = (
      <div className="absolute inset-0 flex items-center justify-center bg-base-200">
        <p className="font-display text-lg tracking-wide text-base-content/40 px-3 text-center line-clamp-3">{post.name}</p>
      </div>
    )
  }

  return (
    <Link
      to={`/posts/${encodeURIComponent(post.id)}`}
      className="relative block aspect-square overflow-hidden bg-base-300 group"
    >
      {thumb}
      {/* Always-visible title/author bar */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 pt-6 pb-2 bg-gradient-to-t from-black/75 to-transparent">
        {post.name && (
          <p className="font-display text-white text-base leading-tight tracking-wide line-clamp-2">{post.name}</p>
        )}
        {post.actor && (
          <p className="font-ui text-xs uppercase tracking-widest text-white/70 mt-0.5 truncate">
            {post.actor.name ?? post.actor.id}
          </p>
        )}
      </div>
      {/* Hover brighten */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
    </Link>
  )
}

function MediaGrid({ posts, hasMore, loadingMore, onLoadMore }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
        {posts.map((post) => (
          <MediaThumb key={post.id} post={post} />
        ))}
      </div>
      <LoadMoreButton hasMore={hasMore} loading={loadingMore} onClick={onLoadMore} />
    </div>
  )
}

// ── Older posts divider ───────────────────────────────────────────────────────

function OlderPostsDivider() {
  return (
    <div className="flex items-center gap-4 py-8">
      <div className="flex-1 h-px bg-base-300" />
      <span className="font-ui text-[10px] uppercase tracking-widest text-base-content/35 shrink-0">
        Older Posts
      </span>
      <div className="flex-1 h-px bg-base-300" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PostList({
  posts = [],
  loading,
  error,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onDeleted,
  ignoreTypeFilter = false,
  emptyMessage,
  lastSeenAt = null,
}) {
  const { activeTypes } = useSelector((state) => state.feed)
  const { t } = useTranslation()

  if (loading) return <Spinner centered />
  if (error)   return <ErrorState message={error} />
  if (!posts.length) return <EmptyState message={emptyMessage ?? t('post.empty')} />

  // The server already filters by the active types (getServerPosts / getCirclePosts
  // send them; group feeds filter server-side by the first type). Re-filtering here
  // only made paginated pages look empty, so we render the server's page as-is and
  // keep `activeTypes` solely to choose the Media grid presentation.
  const visible = posts

  const isMediaGrid = !ignoreTypeFilter && activeTypes.length === 1 && activeTypes[0] === 'Media'

  if (isMediaGrid) {
    return (
      <MediaGrid
        posts={visible}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
      />
    )
  }

  // Insert "Older Posts" divider at the new/seen boundary
  const seenBoundary = lastSeenAt ? new Date(lastSeenAt) : null
  let dividerPlaced = false
  const elements = []
  for (const post of visible) {
    const postDate = new Date(post.publishedAt ?? post.createdAt ?? 0)
    if (!dividerPlaced && seenBoundary && postDate <= seenBoundary) {
      elements.push(<OlderPostsDivider key="__older_divider__" />)
      dividerPlaced = true
    }
    elements.push(<PostCard key={post.id} post={post} onDeleted={onDeleted} />)
  }

  return (
    <div role="feed" className="flex flex-col">
      {elements}
      <LoadMoreButton hasMore={hasMore} loading={loadingMore} onClick={onLoadMore} />
    </div>
  )
}
