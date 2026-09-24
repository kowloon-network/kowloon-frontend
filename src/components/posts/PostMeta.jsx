// PostMeta — author avatar, name, handle (left) + post-type label and compact
// timestamp (right), matching the mobile app's card header.
// Props: post object

import { Link } from 'react-router-dom'
import UserAvatar from '../ui/UserAvatar'
import Timestamp from '../ui/Timestamp'
import { POST_TYPES } from '../../lib/postTypes'

const TIMESTAMP_LINK_TYPES = ['Note', 'Article', 'Media', 'Link', 'Event']

export default function PostMeta({ post }) {
  const author = post?.actor
  const userUrl = author?.id ? `/users/${encodeURIComponent(author.id)}` : null
  const timestampTo = TIMESTAMP_LINK_TYPES.includes(post?.type) && post?.id
    ? `/posts/${encodeURIComponent(post.id)}`
    : null
  const typeMeta = POST_TYPES[post?.type]

  return (
    <div className="flex items-center gap-3">
      {userUrl
        ? <Link to={userUrl}><UserAvatar user={author} size="md" /></Link>
        : <UserAvatar user={author} size="md" />
      }
      <div className="flex flex-col min-w-0 flex-1 leading-[1.05]">
        {userUrl
          ? <Link to={userUrl} className="font-ui text-base font-medium text-base-content truncate !leading-[1.05] hover:text-primary transition-colors">
              {author?.name ?? author?.id}
            </Link>
          : <span className="font-ui text-base font-medium text-base-content truncate !leading-[1.05]">
              {author?.name ?? author?.id}
            </span>
        }
        {userUrl
          ? <Link to={userUrl} className="font-ui text-xs text-base-content/55 dark:text-base-content/70 !leading-[1.05] truncate hover:text-primary transition-colors mt-1">
              {author?.id}
            </Link>
          : <span className="font-ui text-xs text-base-content/55 dark:text-base-content/70 !leading-[1.05] truncate mt-1">
              {author?.id}
            </span>
        }
      </div>
      {/* Type label + compact time — right column, matching the app */}
      <div className="flex flex-col items-end shrink-0 ml-2">
        {typeMeta && (
          <span
            className="font-ui text-[10px] uppercase tracking-[0.16em] leading-none"
            style={{ color: typeMeta.color }}
          >
            {typeMeta.label}
          </span>
        )}
        <Timestamp
          date={post?.published ?? post?.publishedAt ?? post?.createdAt}
          to={timestampTo}
          className="font-ui text-xs text-base-content/55 dark:text-base-content/70 leading-none mt-1"
        />
      </div>
    </div>
  )
}
