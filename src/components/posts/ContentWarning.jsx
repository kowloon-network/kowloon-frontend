// ContentWarning -- the one place the web decides how a post with a content
// warning looks. Every card, thread and page wraps post content in
// <ContentWarningGate>; media checks useContentWarning().blurMedia
// (hooks/useContentWarning.js).
// The rule itself lives in @kowloon/client (getContentWarningDecision) so the
// web and the app always agree.

import { useState } from 'react'
import { AlertTriangle, EyeOff, Lock } from 'lucide-react'
import { CW_CATEGORIES, CW_NOTE_MAX } from '@kowloon/client'
import { useContentWarning } from '../../hooks/useContentWarning'

function warningText(decision) {
  if (decision.byModerator) return `Content warning added by a moderator: ${decision.label}`
  return `Content warning: ${decision.label}`
}

// Small chip shown above a post that has a warning but is shown anyway (the
// reader chose "Show", or it's their own post).
export function ContentWarningChip({ post, decision: given }) {
  const own = useContentWarning(post)
  const decision = given ?? own
  if (!decision.hasWarning) return null
  return (
    <p className="inline-flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-base-content bg-warning/25 px-2 py-1 self-start">
      <AlertTriangle size={12} className="shrink-0" />
      <span>{warningText(decision)}</span>
    </p>
  )
}

/**
 * Wrap a post's content (title, body, media). Header and toolbar stay
 * outside it so the reader always sees who posted.
 *
 * Props:
 *   post      the post or reply
 *   compact   small cards (Discover tiles, notification previews)
 *   header    shown above the warning bar while the content is closed (for
 *             cards whose author line sits inside the gated content)
 *   hideHandled  the caller already collapsed the whole card for 'hide'
 *             (PostCard, Reply) -- treat a reopened card as 'warn'
 */
export function ContentWarningGate({ post, compact = false, hideHandled = false, header = null, children }) {
  const decision = useContentWarning(post)
  const [revealed, setRevealed] = useState(false)
  const [unhidden, setUnhidden] = useState(false)

  if (decision.mode === 'show' || revealed) {
    return (
      <>
        {decision.hasWarning && !compact && <ContentWarningChip post={post} decision={decision} />}
        {children}
      </>
    )
  }

  if (decision.mode === 'hide' && !unhidden && !hideHandled) {
    return (
      <HiddenLine
        label={decision.hiddenLabel}
        onShow={() => setUnhidden(true)}
        compact={compact}
      />
    )
  }

  const bar = (
    <div
      className={`flex flex-col gap-3 border-l-4 border-warning bg-warning/15 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
    >
      <p className={`flex items-start gap-2 font-ui text-base-content ${compact ? 'text-xs' : 'text-sm'}`}>
        <AlertTriangle size={compact ? 13 : 16} className="shrink-0 mt-0.5 text-warning" />
        <span>{warningText(decision)}</span>
      </p>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRevealed(true) }}
        className="self-start font-ui text-xs uppercase tracking-widest px-3 py-1.5 border border-base-content/30 hover:bg-base-200 transition-colors"
      >
        Show post
      </button>
    </div>
  )
  return header ? <>{header}{bar}</> : bar
}

export function HiddenLine({ label, onShow, compact = false }) {
  return (
    <div className={`flex items-center gap-3 text-base-content/60 ${compact ? 'py-1' : 'py-2'}`}>
      <EyeOff size={14} className="shrink-0" />
      <span className="font-ui text-xs uppercase tracking-widest">{label}</span>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShow() }}
        className="ml-auto font-ui text-xs uppercase tracking-widest text-primary hover:opacity-80"
      >
        Show
      </button>
    </div>
  )
}

// Blurs whatever it wraps until the reader taps it.
export function SensitiveMedia({ blur, onReveal, children, className = '' }) {
  if (!blur) return children
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div aria-hidden="true" className="pointer-events-none select-none blur-2xl scale-110">
        {children}
      </div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReveal?.() }}
        className="absolute inset-0 flex items-center justify-center bg-black/40 text-white font-ui text-xs uppercase tracking-widest"
      >
        Sensitive -- tap to show
      </button>
    </div>
  )
}

// ── Composer control ─────────────────────────────────────────────────────────

/**
 * value: { categories: [], note: '' } or null
 * sensitive / onSensitiveChange: the "Blur photos" toggle (shown when hasMedia)
 * locked: the warning was added by a moderator; show it read-only.
 * defaultOpen: start expanded (e.g. a reply that inherited a warning)
 */
export function ContentWarningPicker({
  value,
  onChange,
  sensitive = false,
  onSensitiveChange,
  hasMedia = false,
  locked = false,
  defaultOpen,
}) {
  const hasValue = !!(value && ((value.categories?.length ?? 0) > 0 || value.note))
  // Open while it has a value (even one that arrived after mount, e.g. an
  // edit page loading the post); "Remove" clears it and closes.
  const [openState, setOpen] = useState(!!defaultOpen)
  const open = openState || hasValue || !!sensitive
  const cats = value?.categories ?? []
  const note = value?.note ?? ''

  const set = (next) => {
    const c = next.categories ?? cats
    const n = next.note ?? note
    onChange?.(c.length || n ? { categories: c, note: n } : null)
  }
  const toggleCat = (key) => {
    set({ categories: cats.includes(key) ? cats.filter((k) => k !== key) : [...cats, key] })
  }

  if (locked) {
    const labels = CW_CATEGORIES.filter((c) => cats.includes(c.key)).map((c) => c.label)
    return (
      <div className="flex items-start gap-2 border-l-4 border-warning bg-warning/15 px-3 py-2 font-ui text-sm">
        <Lock size={14} className="shrink-0 mt-0.5" />
        <span>
          Content warning: {[...labels, note].filter(Boolean).join(', ')}
          <span className="block text-xs text-base-content/60">Added by a moderator. Only a moderator can change it.</span>
        </span>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start inline-flex items-center gap-2 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:text-base-content transition-colors"
      >
        <AlertTriangle size={14} />
        Content warning
      </button>
    )
  }

  return (
    <fieldset className="flex flex-col gap-3 border border-base-300 px-3 py-3">
      <div className="flex items-center gap-2">
        <legend className="font-ui text-xs uppercase tracking-widest text-base-content/70 flex items-center gap-2">
          <AlertTriangle size={14} /> Content warning
        </legend>
        <button
          type="button"
          onClick={() => { onChange?.(null); onSensitiveChange?.(false); setOpen(false) }}
          className="ml-auto font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-base-content"
        >
          Remove
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {CW_CATEGORIES.map((c) => {
          const active = cats.includes(c.key)
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggleCat(c.key)}
              className={`px-3 py-1.5 font-ui text-xs uppercase tracking-widest border transition-colors ${
                active
                  ? 'bg-primary text-primary-content border-primary'
                  : 'bg-base-100 text-base-content/60 border-base-300 hover:bg-base-200'
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>
      <input
        type="text"
        value={note}
        maxLength={CW_NOTE_MAX}
        onChange={(e) => set({ note: e.target.value })}
        placeholder="Add a note (optional), e.g. spoilers for Severance S2"
        className="input input-bordered input-sm w-full font-ui"
      />
      {hasMedia && onSensitiveChange && (
        <label className="flex items-center gap-2 font-ui text-sm cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={!!sensitive}
            onChange={(e) => onSensitiveChange(e.target.checked)}
          />
          Blur photos and video until tapped
        </label>
      )}
    </fieldset>
  )
}
