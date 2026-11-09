// PicsLightbox — fullscreen photo viewer for pics.<domain>, two-axis nav:
//   left/right (swipe or arrow keys) — other photos in the SAME post
//   up/down    (swipe or arrow keys) — next/previous POST, landing on its
//                                       first photo
//
// MediaLightbox (extracted from the main site's PostBody.jsx) already owns
// the left/right swipe/zoom/keyboard engine — reused completely unmodified,
// scoped to just the current post's own attachments, so it naturally stops
// at that post's first/last photo with no new clamping logic. Its root is
// `position: fixed inset-0` (always full-viewport, regardless of DOM
// nesting), so the info panel below is a SEPARATE fixed sibling layered on
// top at a higher z-index, not a flex/grid layout partner.
//
// Up/down is new code: a capture-phase touch handler on the outer wrapper
// determines the drag's dominant axis: a mostly-vertical drag is intercepted
// (stopPropagation) before it reaches MediaLightbox's own bubble-phase swipe
// handler, and drives post-to-post nav instead; a mostly-horizontal drag is
// left alone entirely and falls through to MediaLightbox exactly as today.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MediaLightbox from '../components/ui/MediaLightbox'
import PostMeta from '../components/posts/PostMeta'
import PostReacts from '../components/posts/PostReacts'
import PostToolbar from '../components/posts/PostToolbar'
import SafeHtml from '../components/ui/SafeHtml'

// Post-to-post slide: whichever post is leaving exits toward the swipe
// direction, the incoming one enters from the opposite edge — the "swipe up
// reveals the next post" feel of a vertical feed (TikTok/Reels-style), even
// though there's no interactive drag-follow like the horizontal photo swipe
// has (MediaLightbox owns that engine; this is a simpler, non-interactive
// slide layered on top for the axis MediaLightbox doesn't know about).
// `direction` is +1 moving to the next post (swipe up), -1 to the previous
// (swipe down) — passed as framer-motion's `custom` so enter/exit variants
// can react to which way we're going.
const postSlideVariants = {
  enter: (direction) => ({ y: direction >= 0 ? '100%' : '-100%' }),
  center: { y: 0 },
  exit: (direction) => ({ y: direction >= 0 ? '-100%' : '100%' }),
}
const POST_TRANSITION = { duration: 0.28, ease: 'easeInOut' }

const VERTICAL_SWIPE_THRESHOLD = 60
// Left/right (photo-within-post) is the primary, expected gesture; up/down
// (post-to-post) is secondary and should only fire on a clearly vertical
// drag. A real finger rarely moves in a perfectly straight line — a swipe
// that's fundamentally horizontal often has a few pixels of vertical jitter
// in its first moments. A low threshold + simple ">" tie-break locked onto
// "vertical" from that jitter alone, misrouting an intended left/right swipe
// into a post-to-post jump (looked like "randomly jumping to a different
// image"). Raising the threshold and requiring vertical to clearly dominate
// (not just edge out) fixes that without making intentional up/down swipes
// harder to trigger.
const AXIS_LOCK_THRESHOLD = 18
const VERTICAL_DOMINANCE_RATIO = 1.5

export default function PicsLightbox({ posts, activePostIndex, activePhotoIndex, onNavigatePhoto, onNavigatePost, onClose }) {
  const post = posts[activePostIndex]
  const attachments = post?.attachments ?? []

  const touchStartRef = useRef(null)
  const axisRef = useRef(null)
  const [direction, setDirection] = useState(0)

  // Record which way we're navigating before telling the parent, so the
  // slide-out/slide-in variants know which edge to use once this re-renders
  // with the new post.
  function goToPost(newIndex, dir) {
    setDirection(dir)
    onNavigatePost(newIndex)
  }

  const handleTouchStartCapture = (e) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    axisRef.current = null
  }

  const handleTouchMoveCapture = (e) => {
    if (!touchStartRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    if (!axisRef.current && (Math.abs(dx) > AXIS_LOCK_THRESHOLD || Math.abs(dy) > AXIS_LOCK_THRESHOLD)) {
      axisRef.current = Math.abs(dy) > Math.abs(dx) * VERTICAL_DOMINANCE_RATIO ? 'y' : 'x'
    }
    // Vertical drag: keep MediaLightbox's own horizontal handler from ever seeing it.
    if (axisRef.current === 'y') e.stopPropagation()
  }

  const handleTouchEndCapture = (e) => {
    if (axisRef.current === 'y' && touchStartRef.current) {
      const t = e.changedTouches[0]
      const dy = t.clientY - touchStartRef.current.y
      e.stopPropagation()
      if (dy < -VERTICAL_SWIPE_THRESHOLD && activePostIndex < posts.length - 1) goToPost(activePostIndex + 1, 1)
      else if (dy > VERTICAL_SWIPE_THRESHOLD && activePostIndex > 0) goToPost(activePostIndex - 1, -1)
    }
    touchStartRef.current = null
    axisRef.current = null
  }

  // Up/Down arrow keys — MediaLightbox already owns Left/Right/Esc internally.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowUp' && activePostIndex > 0) goToPost(activePostIndex - 1, -1)
      else if (e.key === 'ArrowDown' && activePostIndex < posts.length - 1) goToPost(activePostIndex + 1, 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePostIndex, posts.length, onNavigatePost])

  if (!post) return null

  const mainDomain = window.location.hostname.replace(/^pics\./, '')

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      onTouchStartCapture={handleTouchStartCapture}
      onTouchMoveCapture={handleTouchMoveCapture}
      onTouchEndCapture={handleTouchEndCapture}
    >
      <AnimatePresence initial={false} custom={direction}>
        {/* Single motion.div per post — MediaLightbox's own root is `position:
            fixed`, and a transform on an ancestor (which framer-motion's `y`
            animation applies via CSS transform) changes what `fixed`
            descendants are positioned relative to, so animating this ONE
            wrapper moves the image and the info panel together as one card.
            key={post.id} both drives AnimatePresence's enter/exit tracking
            AND forces MediaLightbox to fully remount on post change — its
            own swipe-commit is a 250ms setTimeout with no cleanup, so
            without a remount its internal drag/zoom state (and, if it fires
            late, its captured onNavigate closure) could bleed into the next
            post. */}
        <motion.div
          key={post.id}
          custom={direction}
          variants={postSlideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={POST_TRANSITION}
          className="absolute inset-0"
        >
          <MediaLightbox items={attachments} index={activePhotoIndex} onClose={onClose} onNavigate={onNavigatePhoto} edgePeek />

          {/* Info panel — fixed sibling layered above MediaLightbox's full-bleed image. */}
          <div className="fixed inset-x-0 bottom-0 z-[110] max-h-[45vh] overflow-y-auto bg-base-100 text-base-content border-t-2 border-base-300 px-4 py-4 flex flex-col gap-3">
            <PostMeta post={post} />
            {post?.body && (
              // Server-sanitized HTML, re-sanitized client-side via SafeHtml (same
              // as PostBody) — not re-rendering PostBody itself here, since
              // it would also try to render this Media post's own attachment
              // gallery a second time (the photo is already the fullscreen image).
              <SafeHtml
                html={post.body}
                className="reading-surface font-reading text-sm max-h-32 overflow-y-auto"
              />
            )}
            <PostReacts post={post} />
            <PostToolbar
              post={post}
              onReplyClick={() => {
                window.location.href = `${window.location.protocol}//${mainDomain}/posts/${encodeURIComponent(post.id)}`
              }}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
