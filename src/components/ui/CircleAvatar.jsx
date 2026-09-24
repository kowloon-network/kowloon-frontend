// CircleAvatar — hexagon icon for a Circle, with a Users-glyph fallback
// when the circle has no custom icon (a circle doesn't have a single
// "name's first letter" the way a person does, so no initial-letter
// fallback here, unlike UserAvatar).
//
// Contract: kowloon-design/components/Avatar.md

import { Users } from 'lucide-react'
import HexAvatar from './HexAvatar'
import sizedUrl from '../../lib/sizedUrl'

const GLYPH_SIZE = { sm: 14, md: 18, lg: 26 }

export default function CircleAvatar({ circle, size = 'md' }) {
  const uri = circle?.icon ? sizedUrl(circle.icon, 200) : null
  return (
    <HexAvatar
      uri={uri}
      size={size}
      alt={circle?.name ?? ''}
      fallback={<Users size={GLYPH_SIZE[size] ?? GLYPH_SIZE.md} className="text-secondary-content/80" strokeWidth={1.75} />}
    />
  )
}
