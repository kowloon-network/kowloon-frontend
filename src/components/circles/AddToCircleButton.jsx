// AddToCircleButton — a single "Add to Circle" button that opens a modal picker
// (search + your circles with member counts, tap to add, inline ✓), matching
// the mobile app's profile Add-to-Circle flow. Membership is pre-marked from the
// server (?contains) each time the picker opens; pins order the list.

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import FocusTrap from 'focus-trap-react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Check, X, Loader2 } from 'lucide-react'
import { sortByPins } from '@kowloon/client'
import { useClient } from '../../hooks/useClient'
import { toast } from '../../app/toast'

export default function AddToCircleButton({ user }) {
  const client = useClient()
  const { t } = useTranslation()
  const { items: myCircles, status } = useSelector((state) => state.myCircles)
  const authUser = useSelector((state) => state.auth.user)
  // Order the list by the user's pins, matching the feed selector.
  const orderedCircles = useMemo(
    () => sortByPins(myCircles, authUser?.prefs?.pinnedCircles || []),
    [myCircles, authUser?.prefs?.pinnedCircles]
  )

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [addedIds, setAddedIds] = useState(new Set())
  const [pendingId, setPendingId] = useState(null)
  const searchRef = useRef(null)
  const panelRef = useRef(null)

  const displayName = user?.name ?? user?.handle ?? user?.id

  // Seed membership (which circles already contain this user) each time the
  // picker opens, so the ✓ reflects reality.
  useEffect(() => {
    if (!open || !client || !user?.id || !authUser?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await client.feeds.getUserCircles({ userId: authUser.id, contains: user.id, limit: 100 })
        const items = res?.orderedItems ?? res?.items ?? []
        const ids = items.filter((c) => c.contains).map((c) => c.id)
        if (!cancelled) setAddedIds(new Set(ids))
      } catch {
        // non-fatal — the picker still works, it just won't pre-mark membership
      }
    })()
    return () => { cancelled = true }
  }, [open, client, user?.id, authUser?.id])

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  const handleAdd = async (circle) => {
    if (!circle || addedIds.has(circle.id) || pendingId) return
    setPendingId(circle.id)
    try {
      await client.activities.addToCircle({ circleId: circle.id, memberId: user.id })
      setAddedIds((prev) => new Set([...prev, circle.id]))
      toast.success(
        t('user.addedToCircle', { defaultValue: 'Added {{name}} to {{circle}}', name: displayName, circle: circle.name }),
        { action: { label: t('user.viewCircle', { defaultValue: 'View' }), to: `/circles/${encodeURIComponent(circle.id)}` } }
      )
    } catch (err) {
      toast.error(
        t('user.addToCircleFailed', { defaultValue: "Couldn't add to {{circle}}", circle: circle.name }),
        { detail: err?.message }
      )
    } finally {
      setPendingId(null)
    }
  }

  const q = query.trim().toLowerCase()
  const filtered = q ? orderedCircles.filter((c) => c.name?.toLowerCase().includes(q)) : orderedCircles

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-1 flex items-center justify-center py-2.5 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:bg-primary/90 transition-colors"
      >
        {t('user.addToCircle', { defaultValue: 'Add to Circle' })}
      </button>

      {/* Focus trap: focus starts in search, Tab stays in the dialog, and
          focus returns to the Add button on close. Escape handled above. */}
      {open && createPortal(
        <FocusTrap
          focusTrapOptions={{
            escapeDeactivates: false,
            allowOutsideClick: true,
            initialFocus: () => searchRef.current ?? panelRef.current,
            fallbackFocus: () => panelRef.current,
            returnFocusOnDeactivate: true,
          }}
        >
        <div>
          <div onClick={() => setOpen(false)} aria-hidden="true" className="fixed inset-0 bg-black/50 z-[80]" />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t('user.addToCircle', { defaultValue: 'Add to Circle' })}
            className="fixed inset-x-2 top-6 bottom-6 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-16 sm:bottom-16 sm:w-full sm:max-w-md bg-base-100 border-2 border-secondary z-[90] flex flex-col"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b-2 border-base-300">
              <p className="font-display text-lg leading-tight tracking-wide flex-1 min-w-0 truncate">
                {t('user.addNameToCircle', { defaultValue: 'Add {{name}} to Circle', name: displayName })}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('common.close', { defaultValue: 'Close' })}
                className="p-1 text-base-content/60 hover:text-base-content transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="shrink-0 px-5 py-3">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('user.searchYourCircles', { defaultValue: 'Search your circles…' })}
                className="w-full bg-base-200 px-3 py-2 font-ui text-sm text-base-content placeholder:text-base-content/35 outline-none"
              />
            </div>

            {/* Circle list */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {status === 'loading' && myCircles.length === 0 ? (
                <div className="px-6 py-10 text-center font-ui text-sm text-base-content/40">
                  {t('common.loading', { defaultValue: 'Loading…' })}
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-6 py-10 text-center font-ui text-sm text-base-content/55">
                  {myCircles.length === 0
                    ? t('circle.noCirclesCreateFirst', { defaultValue: 'No circles yet. Create one first.' })
                    : t('feed.noMatchesCircles', { defaultValue: 'No circles match.' })}
                </p>
              ) : (
                filtered.map((circle) => {
                  const added = addedIds.has(circle.id)
                  const adding = pendingId === circle.id
                  return (
                    <button
                      key={circle.id}
                      type="button"
                      onClick={() => !added && handleAdd(circle)}
                      disabled={added || !!pendingId}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 border-b border-base-300 hover:bg-base-200 transition-colors text-left disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span className="flex flex-col min-w-0">
                        <span className={`font-ui text-sm truncate ${added ? 'text-base-content/50' : 'text-base-content'}`}>
                          {circle.name}
                        </span>
                        {typeof circle.memberCount === 'number' && (
                          <span className="font-ui text-[10px] uppercase tracking-widest text-base-content/40 mt-0.5">
                            {circle.memberCount.toLocaleString()} {t('circle.membersLower', { defaultValue: 'members' })}
                          </span>
                        )}
                      </span>
                      {adding
                        ? <Loader2 size={16} className="animate-spin text-base-content/40 shrink-0" />
                        : added
                          ? <Check size={16} className="text-success shrink-0" />
                          : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
        </FocusTrap>,
        document.body
      )}
    </>
  )
}
