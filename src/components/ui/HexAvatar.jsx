// HexAvatar — hexagon-clip image (or fallback fill+glyph) for Circles and
// Groups. Circles/Groups keep the hex brand mark; user avatars are circular
// instead (see UserAvatar.jsx) — that split is a deliberate, named exception
// to "no rounded corners" (IDEOLOGY.md §2).
//
// Mirrors mobile's three-layer structure (HexAvatar -> CircleAvatar/
// GroupAvatar) — mobile already had this; web hand-rolled the hex-mask CSS
// inline in at least two places instead. This is the shared primitive.
//
// Contract: kowloon-design/components/Avatar.md

import { useState } from 'react'

const hexMaskStyle = {
  WebkitMaskImage: 'url(/hex-mask.svg)',
  maskImage: 'url(/hex-mask.svg)',
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
}

const SIZES = { sm: 'w-7 h-7', md: 'w-10 h-10', lg: 'w-14 h-14' }

// `size` takes a named preset (sm/md/lg) or a raw Tailwind size className
// (e.g. "w-9 h-9") for call sites that need a bespoke dimension.
export default function HexAvatar({ uri, size = 'md', fallback, alt = '' }) {
  const [failed, setFailed] = useState(false)
  const sizeClass = SIZES[size] ?? size
  const showImage = !!uri && !failed

  if (showImage) {
    return (
      <img
        loading="lazy"
        src={uri}
        alt={alt}
        onError={() => setFailed(true)}
        className={`${sizeClass} object-cover shrink-0`}
        style={hexMaskStyle}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} shrink-0 bg-secondary flex items-center justify-center`}
      style={hexMaskStyle}
    >
      {fallback}
    </div>
  )
}
