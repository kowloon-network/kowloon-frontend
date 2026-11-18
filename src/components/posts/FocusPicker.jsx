// FocusPicker -- click the subject of a photo so crops keep it in frame.
//
// Web twin of the app's FocusPicker (mobile/src/components/posts/
// FocusPicker.jsx). Shows the whole photo with a marker at the focus point,
// and two small previews of how it'll look cropped tall (4:5, the feed's
// tallest) and wide (2:1). With no focus chosen, the server finds the subject
// itself after upload, so the marker and previews start centred and say
// "Automatic".
//
// Rendered inline (not as a popover) so it lives inside the composer's own
// scroll area and focus trap.
//
// focus: { x, y } fractions (0,0 = top left) or null; onChange(focus|null).

import { useState } from 'react'
import { cropPositionPercent } from '@kowloon/client'

const MAX_HEIGHT = 260
const MARK = 28
const PREVIEWS = [
  { label: 'Tall', ratio: 4 / 5 },
  { label: 'Wide', ratio: 2 },
]

function round3(n) {
  return Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000
}

export default function FocusPicker({ uri, focus, onChange }) {
  const [ratio, setRatio] = useState(null) // the photo's width / height
  const f = focus || { x: 0.5, y: 0.5 }

  function pick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    onChange({
      x: round3((e.clientX - rect.left) / rect.width),
      y: round3((e.clientY - rect.top) / rect.height),
    })
  }

  // Keyboard: arrows nudge the point 5% at a time.
  function onKeyDown(e) {
    const step = 0.05
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    onChange({ x: round3(f.x + m[0]), y: round3(f.y + m[1]) })
  }

  return (
    <div>
      <div className="bg-base-200 flex justify-center" style={{ minHeight: ratio ? undefined : 160 }}>
        {/* The clickable box is exactly the photo's shape, so click
            coordinates map straight to fractions of the photo. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Photo focus point. Click the subject to keep it in frame when the photo is cropped."
          aria-valuetext={focus ? `${Math.round(f.x * 100)}% across, ${Math.round(f.y * 100)}% down` : 'Automatic'}
          onClick={pick}
          onKeyDown={onKeyDown}
          className="relative cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={ratio ? { width: `min(100%, ${Math.round(MAX_HEIGHT * ratio)}px)`, aspectRatio: ratio } : { width: '100%', height: 160 }}
        >
          <img
            src={uri}
            alt=""
            draggable={false}
            className="block w-full h-full object-contain select-none pointer-events-none"
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget
              if (w && h) setRatio(w / h)
            }}
          />
          {ratio ? (
            <span
              aria-hidden="true"
              className="absolute pointer-events-none border-2 border-white"
              style={{
                left: `calc(${f.x * 100}% - ${MARK / 2}px)`,
                top: `calc(${f.y * 100}% - ${MARK / 2}px)`,
                width: MARK,
                height: MARK,
                opacity: focus ? 1 : 0.6,
                boxShadow: '0 0 3px rgba(0,0,0,0.6), inset 0 0 3px rgba(0,0,0,0.6)',
              }}
            >
              <span className="absolute bg-white" style={{ left: MARK / 2 - 3, top: MARK / 2 - 3, width: 2, height: 2 }} />
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-end gap-2.5 mt-3">
        {PREVIEWS.map((p) => (
          <div key={p.label}>
            <div className="bg-base-200 overflow-hidden" style={{ height: 64, aspectRatio: p.ratio }}>
              {ratio ? (
                <img
                  src={uri}
                  alt=""
                  className="block w-full h-full object-cover"
                  style={(() => {
                    const pos = cropPositionPercent(ratio, p.ratio, f)
                    return { objectPosition: `${pos.left} ${pos.top}` }
                  })()}
                />
              ) : null}
            </div>
            <div className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/55 mt-1">{p.label}</div>
          </div>
        ))}
        <div className="flex-1 flex justify-end">
          {focus ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="font-ui uppercase tracking-[0.14em] text-[11px] text-primary py-1 hover:opacity-80"
            >
              Automatic
            </button>
          ) : (
            <span className="font-ui uppercase tracking-[0.14em] text-[10px] text-base-content/45 py-1">Automatic</span>
          )}
        </div>
      </div>
      <p className="font-ui text-xs text-base-content/60 mt-2">
        {focus
          ? 'Crops will keep this spot in frame.'
          : 'Click the subject to keep it in frame when the photo is cropped. Otherwise Kowloon picks it out.'}
      </p>
    </div>
  )
}
