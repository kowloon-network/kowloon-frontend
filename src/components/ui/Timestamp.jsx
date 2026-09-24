// Timestamp — relative or absolute date with full datetime tooltip.
// Props: date (ISO string or Date), absolute (bool), to (optional route — wraps in Link)
//
// Relative formatting is the one shared timeAgo algorithm from
// @kowloon/client — this used to also carry a second, cruder algorithm
// behind a `compact` prop, used only by PostMeta, while every other call
// site (Reply, notifications, pages) got the other one: a post showed "2h"
// while the reply directly under it showed "2h ago". One algorithm now,
// same as mobile always had. See kowloon-design/components/Timestamp.md.

import { Link } from 'react-router-dom'
import { timeAgo } from '@kowloon/client'

export default function Timestamp({ date, absolute = false, to, className }) {
  if (!date) return null
  const full = new Date(date).toLocaleString()
  const display = absolute ? full : timeAgo(date)

  const time = (
    <time
      dateTime={new Date(date).toISOString()}
      title={full}
      className={className ?? 'font-ui text-xs sm:text-sm text-base-content/70 uppercase tracking-widest'}
    >
      {display}
    </time>
  )

  return to
    ? <Link to={to} className="hover:text-primary transition-colors">{time}</Link>
    : time
}
