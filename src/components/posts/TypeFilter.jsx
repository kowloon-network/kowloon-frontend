// TypeFilter — shared post-type filter row (icon-only), converged with the
// mobile app's TypeFilter. No "All" button: an empty selection already means
// "all types". Colored icon = active, dimmed ink = inactive.
//
// Solo-on-first-tap (feedback_type_filter_solo):
//   • From "all" (nothing selected), the first tap SOLOS that one type.
//   • Tapping an active type removes it; emptying the set wraps back to all.
//   • Tapping an inactive type adds it; selecting every type normalizes to [].
//
// State lives in feedSlice — the component reads `activeTypes` and dispatches
// `setTypes` with the whole next array, mirroring mobile's onSetTypes(array).
//
// Inactive icons stay tinted (opacity-25 on the type-colored icon), not
// grayscale — a faded whisper of the type's own color still reads as
// "nameable as its type," where full desaturation erases that signal
// entirely (IDEOLOGY.md §4). See kowloon-design/components/TypeFilter.md.

import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { setTypes } from '../../app/feedSlice'
import PostTypeIcon from '../ui/PostTypeIcon'
import { POST_TYPE_NAMES } from '../../lib/postTypes'

export default function TypeFilter({ className = '' }) {
  const dispatch = useDispatch()
  const { activeTypes } = useSelector((state) => state.feed)
  const { t } = useTranslation()

  const isAll = !activeTypes || activeTypes.length === 0

  const handlePress = (type) => {
    if (isAll) {
      dispatch(setTypes([type]))                       // all on → solo this one
    } else if (activeTypes.includes(type)) {
      dispatch(setTypes(activeTypes.filter((x) => x !== type)))  // remove; [] wraps to all
    } else {
      const next = [...activeTypes, type]              // add; full set normalizes to []
      dispatch(setTypes(next.length === POST_TYPE_NAMES.length ? [] : next))
    }
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {POST_TYPE_NAMES.map((type) => {
        const active = isAll || activeTypes.includes(type)
        return (
          <button
            key={type}
            type="button"
            onClick={() => handlePress(type)}
            aria-pressed={!isAll && activeTypes.includes(type)}
            title={t(`postTypes.${type}`, { defaultValue: type })}
            className="shrink-0 transition-opacity"
          >
            <span className={active ? '' : 'opacity-25'}>
              <PostTypeIcon type={type} size="sm" />
            </span>
          </button>
        )
      })}
    </div>
  )
}
