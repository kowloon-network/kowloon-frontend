// GroupAvatar — visually identical to CircleAvatar (same hex mark, same
// Users-glyph fallback). Separate component name so call sites read
// naturally, matching mobile's GroupAvatar/CircleAvatar split.
//
// Contract: kowloon-design/components/Avatar.md

import CircleAvatar from './CircleAvatar'

export default function GroupAvatar({ group, size = 'md' }) {
  return <CircleAvatar circle={group} size={size} />
}
