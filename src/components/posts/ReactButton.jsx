// ReactButton — emoji reaction picker for posts and replies.
// One reaction per user (matches the mobile app + server model): the button
// shows the viewer's current emoji when they've reacted; tapping it clears the
// reaction (emoji: null), tapping a different emoji replaces it in one step, and
// tapping any emoji with none set adds it. All optimistic, with rollback on
// failure. Reads post.myReact / post.reactCount, which the server already
// returns for the authed viewer.
//
// Fetches the available emoji set from server settings on first use (cached
// module-level). Shows a small popup of options above the button.

import { useState, useEffect, useRef } from 'react'
import { Smile } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { toast } from '../../app/toast'

// Module-level cache so we only fetch once per session
let cachedEmojis = null
let fetchPromise = null

async function getEmojis(client) {
  if (cachedEmojis) return cachedEmojis
  if (!fetchPromise) {
    fetchPromise = client.feeds.getServerInfo()
      .then((info) => {
        cachedEmojis = info?.settings?.reactEmojis?.length
          ? info.settings.reactEmojis
          : DEFAULT_EMOJIS
        return cachedEmojis
      })
      .catch(() => {
        cachedEmojis = DEFAULT_EMOJIS
        return cachedEmojis
      })
  }
  return fetchPromise
}

const DEFAULT_EMOJIS = [
  { emoji: '👍', name: 'Like' },
  { emoji: '❤️', name: 'Love' },
  { emoji: '😂', name: 'Laugh' },
  { emoji: '😮', name: 'Shocked' },
  { emoji: '😭', name: 'Sad' },
  { emoji: '🤬', name: 'Angry' },
]

export default function ReactButton({ post, t, onReacted }) {
  const client = useClient()
  const [open, setOpen] = useState(false)
  const [emojis, setEmojis] = useState(cachedEmojis ?? DEFAULT_EMOJIS)
  const [pending, setPending] = useState(false)
  const [count, setCount] = useState(post?.reactCount ?? 0)
  const [myReact, setMyReact] = useState(post?.myReact ?? null)
  const [popupBottom, setPopupBottom] = useState(0)
  const buttonRef = useRef(null)
  const popupRef = useRef(null)

  // Refresh local state when a different post (or updated counts) is passed in —
  // e.g. the parent refetched after a reaction landed.
  useEffect(() => {
    setCount(post?.reactCount ?? 0)
    setMyReact(post?.myReact ?? null)
  }, [post?.id, post?.reactCount, post?.myReact])

  // Load emojis from server (instant if cached)
  useEffect(() => {
    if (!client || cachedEmojis) return
    getEmojis(client).then(setEmojis)
  }, [client])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (
        popupRef.current && !popupRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Position popup above the button; recompute on resize/scroll
  useEffect(() => {
    if (!open) return
    const update = () => {
      if (!buttonRef.current) return
      const rect = buttonRef.current.getBoundingClientRect()
      setPopupBottom(window.innerHeight - rect.top + 8)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  // One reaction per user. Tapping your current emoji removes it; tapping a
  // different one replaces it (one call); tapping any when you have none adds it.
  const react = async (emoji, name) => {
    if (!client || pending) return
    setOpen(false)
    setPending(true)

    const clearing = emoji === myReact
    const prevReact = myReact
    const prevCount = count

    // Optimistic update.
    if (clearing) {
      setMyReact(null)
      setCount((c) => Math.max(0, c - 1))
    } else {
      setMyReact(emoji)
      if (!prevReact) setCount((c) => c + 1) // new reactor (replace keeps count)
    }

    try {
      const res = await client.activities.react({
        postId: post.id,
        emoji: clearing ? null : emoji,
        name: clearing ? undefined : name || emoji,
      })
      onReacted?.(res)
    } catch (err) {
      setMyReact(prevReact)
      setCount(prevCount)
      toast.error('Reaction failed', { detail: err?.message })
    } finally {
      setPending(false)
    }
  }

  const handleButtonClick = () => {
    // Already reacted → a plain click removes it (one reaction per user).
    // With no reaction yet, click opens the picker to add one.
    if (myReact) react(myReact)
    else setOpen((o) => !o)
  }

  return (
    <div className="relative flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        disabled={pending}
        title={myReact ? t('post.reactRemove', { defaultValue: 'Remove reaction' }) : t('post.react')}
        aria-label={myReact ? t('post.reactRemove', { defaultValue: 'Remove reaction' }) : t('post.react')}
        className={`inline-flex items-center gap-1.5 text-base transition-colors disabled:opacity-30 ${
          myReact ? 'text-primary hover:text-primary/70' : 'text-base-content/50 hover:text-base-content'
        }`}
      >
        {myReact ? (
          <span className="text-base leading-none">{myReact}</span>
        ) : (
          <Smile size={18} strokeWidth={1.75} />
        )}
        {/* Count lives in PostReacts (feed) / ReactCounts (detail), not on
            the button (#79) -- this used to duplicate it. */}
      </button>

      {open && (
        <div
          ref={popupRef}
          role="menu"
          aria-label={t('post.reactPickerLabel', { defaultValue: 'Choose a reaction' })}
          style={{ bottom: popupBottom }}
          className="fixed left-[5px] right-[5px] flex flex-wrap justify-center gap-0 bg-base-100 border-2 border-primary z-40"
        >
          {emojis.map(({ emoji, name }) => {
            const active = emoji === myReact
            return (
              <button
                key={name}
                type="button"
                role="menuitem"
                onClick={() => react(emoji, name)}
                title={name}
                aria-label={name}
                className={`px-2.5 py-2 text-xl hover:bg-base-200 transition-colors leading-none ${
                  active ? 'bg-base-200' : ''
                }`}
              >
                {emoji}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
