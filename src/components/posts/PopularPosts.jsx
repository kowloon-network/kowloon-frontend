// PopularPosts — sidebar widget showing most popular posts on the server.
// Ranked by reaction + reply count. Shows post type color, title/summary, author, and counts.
// Media posts additionally show a thumbnail or A/V placeholder.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Smile, Play, Music } from 'lucide-react'
import { POST_TYPES } from '../../lib/postTypes'
import stripHtml from '../../lib/stripHtml'
import sizedUrl from '../../lib/sizedUrl'
import PostTypeIcon from '../ui/PostTypeIcon'
import { useClient } from '../../hooks/useClient'
import { useSelector } from 'react-redux'
import { getContentWarningDecision } from '@kowloon/client'

const MEDIA_COLOR = POST_TYPES['Media']?.color ?? '#009084'

function MediaThumb({ post }) {
  if (post.featuredImage) {
    return (
      <img
        loading="lazy"
        src={sizedUrl(post.featuredImage, 200)}
        alt={post.name ?? ''}
        className="w-16 h-16 object-cover shrink-0"
      />
    )
  }

  const mt = post.attachments?.[0]?.mediaType ?? ''
  const isAudio = mt.startsWith('audio/')
  const isVideo = mt.startsWith('video/')
  if (!isAudio && !isVideo) return null

  return (
    <div
      className="w-16 h-16 shrink-0 flex items-center justify-center"
      style={{ backgroundColor: MEDIA_COLOR + '22' }}
    >
      {isAudio
        ? <Music size={22} style={{ color: MEDIA_COLOR }} />
        : <Play  size={22} style={{ color: MEDIA_COLOR }} />
      }
    </div>
  )
}

export default function PopularPosts() {
  const { t } = useTranslation()
  const client = useClient()
  const [posts, setPosts] = useState([])
  const user = useSelector((state) => state.auth.user)

  useEffect(() => {
    if (!client) return
    client.feeds.getServerPosts({ limit: 20 })
      .then((res) => {
        const items = res?.orderedItems ?? []
        // Sort by combined react + reply count descending, take top 7
        const sorted = [...items]
          .sort((a, b) => (b.reactCount + b.replyCount) - (a.reactCount + a.replyCount))
          .slice(0, 7)
        setPosts(sorted)
      })
      .catch(() => {})
  }, [client])

  if (!posts.length) return null

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center gap-2 mb-3" style={{ minHeight: '36px' }}>
        <span className="opacity-50 !w-11 !h-11" style={{ filter: 'grayscale(1)' }}><PostTypeIcon type="Article" size="lg" /></span>
        <h3 className="font-display text-3xl tracking-wide text-base-content leading-none">{t('sidebar.popularPosts')}</h3>
      </div>
      <ul className="flex flex-col gap-0">
        {posts.map((post) => {
          const typeColor = POST_TYPES[post.type]?.color
          // Content warning: name the warning instead of the post's words or picture.
          const cw = getContentWarningDecision(post, { prefs: user?.prefs, viewerId: user?.id })
          const cwText = cw.mode === 'hide' ? cw.hiddenLabel : cw.mode === 'warn' ? `Content warning: ${cw.label}` : null
          const showThumb = post.type === 'Media' && !cwText && !cw.blurMedia
          const author = post.actor

          return (
            <li key={post.id} className="border-b border-base-300 last:border-b-0 mb-3 last:mb-0">
              <Link
                to={`/posts/${encodeURIComponent(post.id)}`}
                className="flex flex-col gap-1.5 py-4 px-3 -mx-3 hover:bg-base-300 transition-colors"
              >
                {/* Type indicator + content + optional thumb */}
                <div className="flex items-start gap-2">
                  <div
                    className="w-1 self-stretch shrink-0 mt-0.5"
                    style={{ backgroundColor: typeColor }}
                  />
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      {post.name && !cwText && (
                        <span className="font-display text-xl leading-tight tracking-wide">
                          {post.name}
                        </span>
                      )}
                      <p className={`font-reading text-base-content/75 leading-snug line-clamp-2 ${post.name ? 'text-sm' : 'text-base'}`}>
                        {cwText ?? post.textPreview ?? stripHtml(post.summary)}
                      </p>
                    </div>
                    {showThumb && <MediaThumb post={post} />}
                  </div>
                </div>

                {/* Author + counts */}
                <div className="flex items-center justify-between pl-3">
                  <span className="font-ui text-sm font-bold uppercase tracking-widest text-base-content/75">
                    {author?.name ?? author?.displayName}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-ui text-xs uppercase tracking-widest text-base-content/65">
                      <Smile size={11} />
                      {post.reactCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1 font-ui text-xs uppercase tracking-widest text-base-content/65">
                      <MessageSquare size={11} />
                      {post.replyCount ?? 0}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
