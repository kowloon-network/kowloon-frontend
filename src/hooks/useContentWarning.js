// Content-warning hooks. The rule lives in @kowloon/client
// (getContentWarningDecision); the components are in
// components/posts/ContentWarning.jsx.

import { useState } from 'react'
import { useSelector } from 'react-redux'
import { getContentWarningDecision } from '@kowloon/client'

// What the signed-in reader sees for this post: { mode, label, hiddenLabel,
// blurMedia, byModerator, hasWarning }.
export function useContentWarning(post) {
  const user = useSelector((state) => state.auth.user)
  return getContentWarningDecision(post, { prefs: user?.prefs, viewerId: user?.id })
}

// For cards that collapse entirely when the reader hides a category:
// { hidden, label, unhide }. Render <HiddenLine> while hidden is true.
export function useHiddenCard(post) {
  const decision = useContentWarning(post)
  const [unhidden, setUnhidden] = useState(false)
  return {
    hidden: decision.mode === 'hide' && !unhidden,
    label: decision.hiddenLabel,
    unhide: () => setUnhidden(true),
  }
}

// For compact cards (Discover tiles and rows, the Pics grid) that can't show
// a warning bar: whether to drop the picture, and the text to show instead
// of the post's. Discover items carry the author as item.actor.
export function useCompactWarning(item) {
  const d = useContentWarning(item ? { ...item, actorId: item.actorId ?? item.actor?.id } : item)
  const covered = d.mode !== 'show'
  return {
    hideImage: covered || d.blurMedia,
    text: covered ? (d.mode === 'hide' ? d.hiddenLabel : `Content warning: ${d.label}`) : null,
  }
}
