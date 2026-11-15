// PostCard — full post preview card.
// Composes PostMeta, PostTypeTag, PostBody, and PostToolbar.
// Props: post object

import PostMeta from './PostMeta'
import PostBody from './PostBody'
import PostReacts from './PostReacts'
import PostToolbar from './PostToolbar'
import VisibilityIcon from '../ui/VisibilityIcon'
import EventCard from './EventCard'
import { ContentWarningGate, HiddenLine } from './ContentWarning'
import { useHiddenCard } from '../../hooks/useContentWarning'

export default function PostCard({ post, onDeleted, showFull = false }) {
  if (post?.type === 'Event') return <EventCard post={post} showFull={showFull} />
  return <StandardPostCard post={post} onDeleted={onDeleted} showFull={showFull} />
}

function StandardPostCard({ post, onDeleted, showFull }) {
  // Content warnings (ContentWarning.jsx): a category the reader hides
  // collapses the whole card to one line; otherwise the header stays and the
  // content sits behind the warning.
  const hidden = useHiddenCard(post)
  if (hidden.hidden) {
    return (
      <article id={post?.id} data-post-id={post?.id} className="py-3 mb-4">
        <HiddenLine label={hidden.label} onShow={hidden.unhide} />
      </article>
    )
  }

  return (
    <article
      id={post?.id}
      data-post-id={post?.id}
      className={`post-type-${post?.type?.toLowerCase()} flex flex-col gap-3 py-5 mb-8`}
    >
      <PostMeta post={post} />
      <ContentWarningGate post={post} hideHandled>
        <PostBody post={post} showFull={showFull} />
      </ContentWarningGate>
      <PostReacts post={post} />
      {/* #65: PostTypeIcon used to render here too, duplicating the colored
          type label PostMeta already shows above (e.g. "MEDIA" in the same
          teal) -- non-interactive and redundant, removed per direct
          feedback. VisibilityIcon stays; that one was well-received. */}
      <div className="flex items-center gap-3 pt-2">
        <VisibilityIcon visibility={post?.visibility} />
        <PostToolbar post={post} onDeleted={onDeleted} />
      </div>
    </article>
  )
}
