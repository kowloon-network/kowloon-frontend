// PostImages -- how a post's photos are shaped and cropped (web).
//
// The rules live in @kowloon/client's imageLayout.js (shared with the app,
// which is the source of truth -- see mobile PostImages.jsx): each image
// keeps its own shape within limits (no taller than 4:5, no wider than 2.5:1;
// header images no taller than 5:4), several images sit in rows that keep
// their shapes, and any crop is anchored on the image's focus point so the
// subject stays in frame.
//
// Images whose size the server doesn't know (old uploads, some links) are
// measured when they load and re-laid out then.

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  layoutImageRows,
  naturalRatio,
  displayRatio,
  cropPositionPercent,
  FEED_IMAGE_LIMITS,
  HEADER_IMAGE_LIMITS,
} from '@kowloon/client'

const GAP = 4

// Remember sizes measured at load time, keyed by URL. Measured sizes may come
// from a downsized thumbnail, so they're trusted for shape only (flagged
// `measured` so they never cap a lone image's width).
function useMeasured() {
  const [sizes, setSizes] = useState({})
  const onMeasured = useCallback((uri, w, h) => {
    if (!uri || !w || !h) return
    setSizes((prev) => (prev[uri] ? prev : { ...prev, [uri]: { width: w, height: h, measured: true } }))
  }, [])
  return [sizes, onMeasured]
}

function percent(position) {
  return `${Math.round(position.x * 1000) / 10}% ${Math.round(position.y * 1000) / 10}%`
}

// items: [{ uri, kind: 'image'|'video'|'audio'|'file', width, height, focus, alt }]
// cellAction(index) -> { to } (router link) | { onClick } | null.
// renderOverlay(index) -> node drawn over a cell (e.g. "+3 more").
// renderPlaceholder(item, onMeasure) -> node for non-image cells.
// srcFor(item, cellCount) -> the URL to load (e.g. a sized thumbnail).
export function ImageRows({
  items,
  cellAction,
  renderOverlay,
  renderPlaceholder,
  srcFor,
  limits = FEED_IMAGE_LIMITS,
  className = '',
}) {
  const [sizes, onMeasured] = useMeasured()

  const sized = useMemo(
    () =>
      items.map((it) => {
        // Audio and plain files have no picture: give them a square tile.
        if (it.kind === 'audio' || it.kind === 'file') return { ...it, width: 1, height: 1, measured: true }
        if (naturalRatio(it)) return it
        return sizes[it.uri] ? { ...it, ...sizes[it.uri] } : it
      }),
    [items, sizes]
  )
  const rows = useMemo(() => layoutImageRows(sized, { limits }), [sized, limits])

  const lone = sized.length === 1 ? sized[0] : null
  // A small lone image isn't blown up past its own pixel width.
  const loneMax = lone && lone.kind === 'image' && !lone.measured && lone.width > 1 ? lone.width : undefined

  return (
    <div className={`flex flex-col ${className}`} style={{ gap: GAP }}>
      {rows.map((row, r) => (
        <div key={r} className="flex items-start" style={{ gap: GAP }}>
          {row.cells.map(({ index, ratio, position }, _j, cells) => {
            const rowSum = cells.reduce((sum, c) => sum + c.ratio, 0)
            const it = sized[index]
            const needsMeasure = !naturalRatio(items[index])
            const inner = (
              <div className="relative w-full h-full overflow-hidden bg-base-300">
                {it.kind === 'image' ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={srcFor ? srcFor(it, row.cells.length) : it.uri}
                    alt={it.alt || ''}
                    className="block w-full h-full object-cover"
                    style={{ objectPosition: percent(position) }}
                    onLoad={needsMeasure ? (e) => onMeasured(it.uri, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight) : undefined}
                  />
                ) : (
                  renderPlaceholder?.(it, needsMeasure ? (w, h) => onMeasured(it.uri, w, h) : undefined)
                )}
                {renderOverlay?.(index)}
              </div>
            )
            const action = cellAction?.(index)
            return (
              <div
                key={`${it.uri}-${index}`}
                // flex-grow is normalised to ratio / sum(row ratios) so a
                // row's grows sum to 1: CSS hands out only part of the free
                // space when they sum to less (a lone 4:5 cell would fill
                // just 80% of the row). See imageLayout.js.
                style={{ flex: `${ratio / rowSum} 1 0`, aspectRatio: ratio, minWidth: 0, maxWidth: loneMax }}
              >
                {action?.to ? (
                  <Link to={action.to} className="block w-full h-full" aria-label={it.alt || undefined}>{inner}</Link>
                ) : action?.onClick ? (
                  <button
                    type="button"
                    onClick={action.onClick}
                    aria-label={it.alt || 'Open'}
                    className={`block w-full h-full p-0 ${it.kind === 'image' ? 'cursor-zoom-in' : 'cursor-pointer'}`}
                  >
                    {inner}
                  </button>
                ) : (
                  inner
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// A single header image (Article/Note/Event/Link): keeps its shape between
// 5:4 and 2.5:1 by default, cropped around its focus point.
// info: { width, height, focus } -- the post's featuredImageInfo.
// src: the URL to load (may be a sized thumbnail of `uri`).
export function HeaderImage({ uri, src, info, alt = '', onClick, limits = HEADER_IMAGE_LIMITS, className = '' }) {
  const [sizes, onMeasured] = useMeasured()
  const known = naturalRatio(info) ? info : sizes[uri]
  const ratio = displayRatio(known, limits)
  const pos = cropPositionPercent(naturalRatio(known), ratio, info?.focus)
  return (
    <img
      loading="lazy"
      decoding="async"
      src={src || uri}
      alt={alt}
      onClick={onClick}
      className={`block w-full object-cover bg-base-300 ${onClick ? 'cursor-zoom-in' : ''} ${className}`}
      style={{ aspectRatio: ratio, objectPosition: `${pos.left} ${pos.top}` }}
      onLoad={naturalRatio(info) ? undefined : (e) => onMeasured(uri, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
    />
  )
}
