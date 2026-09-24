// EventCard — event-specific post layout.
// Calendar tear-off block (month + day) beside title, location prominent below.
// Used by PostCard whenever post.type === 'Event'.

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PostMeta from './PostMeta'
import PostToolbar from './PostToolbar'
import PostTypeIcon from '../ui/PostTypeIcon'
import VisibilityIcon from '../ui/VisibilityIcon'
import { POST_TYPES } from '../../lib/postTypes'

const EVENT_COLOR = POST_TYPES['Event']?.color ?? '#cc272e'

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT']

function formatStartTime(start) {
  if (!start) return null
  return new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
}

function CalendarBlock({ date }) {
  if (!date) return null
  const d = new Date(date)
  const month = MONTHS[d.getMonth()]
  const day   = d.getDate()
  const dow   = DAYS[d.getDay()]

  return (
    <div className="flex flex-col shrink-0 w-14 border-2 border-base-300 overflow-hidden self-start">
      {/* Month strip */}
      <div
        className="flex items-center justify-center py-0.5"
        style={{ backgroundColor: EVENT_COLOR }}
      >
        <span className="font-ui text-[10px] font-bold uppercase tracking-widest text-white">{month}</span>
      </div>
      {/* Day number */}
      <div className="flex flex-col items-center justify-center py-1 bg-base-100">
        <span className="font-display text-3xl leading-none text-base-content">{day}</span>
        <span className="font-ui text-[9px] uppercase tracking-widest text-base-content/40 mt-0.5">{dow}</span>
      </div>
    </div>
  )
}

export default function EventCard({ post, showFull = false }) {
  const { t } = useTranslation()
  const startTime    = formatStartTime(post?.startTime)
  const locationName = post?.location?.name ?? null
  const isTruncated  = !showFull && !!post?.summary
  const body  = isTruncated ? post.summary : (post?.body ?? '')
  const image = post?.featuredImage ?? null
  const postUrl = post?.id ? `/posts/${encodeURIComponent(post.id)}` : null

  const subheader = [startTime, locationName].filter(Boolean).join(' | ')

  return (
    <article
      id={post?.id}
      data-post-id={post?.id}
      className="flex flex-col gap-3 py-5 mb-8"
    >

      {/* Featured image */}
      {image && (
        <img loading="lazy" src={image} alt="" className="w-full max-h-64 object-cover" />
      )}

      {/* Top row: calendar block + title + subheader */}
      <div className="flex gap-4 items-start">
        <CalendarBlock date={post?.startTime} />

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <Link
            to={`/posts/${encodeURIComponent(post?.id)}`}
            className="font-display text-4xl leading-tight tracking-wide text-base-content hover:text-primary transition-colors"
          >
            {post?.title ?? t('post.untitledEvent')}
          </Link>

          {subheader && (
            <p className="font-ui text-sm tracking-wide font-bold text-base-content">{subheader}</p>
          )}
        </div>
      </div>

      {/* Author */}
      <PostMeta post={post} />

      {/* Body (description) if present */}
      {body && (
        <>
          <div
            className="font-reading text-base-content/80 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: body }}
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
        </>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 pt-2">
        <VisibilityIcon visibility={post?.visibility} />
        <PostTypeIcon type="Event" size="sm" />
        <PostToolbar post={post} />
      </div>

    </article>
  )
}
