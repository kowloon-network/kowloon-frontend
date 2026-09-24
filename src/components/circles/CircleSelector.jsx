// CircleSelector — reusable dropdown for selecting a circle or post audience.
//
// Props:
//   circles       — array of { id, name, summary }
//   value         — 'public' | 'server' | circleId
//   onChange      — fn(value)
//   showAudience  — include Public / Server options at top (for post addressing)
//   allowCreate   — show "New circle…" option at bottom
//   onCreateCircle — fn() called when "New circle…" is clicked
//   direction     — 'down' (default) | 'up' — which way the panel opens
//   className     — extra classes on the trigger button

import { useState, useRef, useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, ChevronDown } from 'lucide-react'
import CircleAvatar from '../ui/CircleAvatar'
import GroupAvatar from '../ui/GroupAvatar'

export default function CircleSelector({
  circles = [],
  groups = [],
  value = 'public',
  onChange,
  showAudience = false,
  allowCreate = false,
  onCreateCircle,
  direction = 'down',
  variant = 'default', // 'default' | 'title'
  className = '',
  constrain = null, // 'server' — cap the audience so it can't widen past the server (reshare rule #47)
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const id = useId()
  const listboxId = `${id}-listbox`

  const [open, setOpen]         = useState(false)
  const [query, setQuery]       = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const containerRef = useRef(null)
  const searchRef    = useRef(null)
  const optionRefs   = useRef([])

  const AUDIENCE_OPTIONS = [
    // A server-capped reshare (#47) can't be widened back to public.
    ...(constrain === 'server'
      ? []
      : [{ id: 'public', label: t('circle.public'), summary: t('circle.publicSummary') }]),
    { id: 'server', label: t('circle.server'), summary: t('circle.serverSummary') },
  ]

  // Filter circles / groups — only apply filter at 2+ chars
  const q = query.toLowerCase()
  const matches = (o) =>
    o.name?.toLowerCase().includes(q) || o.summary?.toLowerCase().includes(q)
  const filtered = query.length >= 2 ? circles.filter(matches) : circles
  const filteredGroups = query.length >= 2 ? groups.filter(matches) : groups

  // Flat list of all selectable options for keyboard nav
  const allOptions = [
    ...(showAudience ? AUDIENCE_OPTIONS : []),
    ...filtered,
    ...filteredGroups,
    ...(allowCreate ? [{ id: '__create__', label: t('circle.new') }] : []),
  ]

  // Resolve trigger label
  const audience = AUDIENCE_OPTIONS.find((a) => a.id === value)
  const circle   = circles.find((c) => c.id === value)
  const group    = groups.find((g) => g.id === value)
  const label    = audience?.label ?? circle?.name ?? group?.name ?? 'Select…'

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
        setFocusedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus the right element when focusedIndex changes
  useEffect(() => {
    if (!open) return
    if (focusedIndex === -1) {
      searchRef.current?.focus()
    } else {
      optionRefs.current[focusedIndex]?.focus()
    }
  }, [focusedIndex, open])

  const handleOpen = () => {
    setOpen((o) => !o)
    setFocusedIndex(-1)
  }

  const handleSelect = (id) => {
    onChange?.(id)
    setOpen(false)
    setQuery('')
    setFocusedIndex(-1)
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (allOptions.length > 0) setFocusedIndex(0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (allOptions.length > 0) setFocusedIndex(allOptions.length - 1)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      setFocusedIndex(-1)
    }
  }

  const handleOptionKeyDown = (e, index) => {
    const opt = allOptions[index]
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(index < allOptions.length - 1 ? index + 1 : 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (index === 0) setFocusedIndex(-1)
      else setFocusedIndex(index - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (opt.id === '__create__') { setOpen(false); onCreateCircle ? onCreateCircle() : navigate('/circles/new') }
      else handleSelect(opt.id)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      setFocusedIndex(-1)
    } else if (e.key === 'Tab') {
      setOpen(false)
      setQuery('')
      setFocusedIndex(-1)
    }
  }

  const panelPos = direction === 'up'
    ? 'bottom-full mb-0 border-b-4 border-b-primary border-t-2'
    : 'top-full mt-0 border-t-4 border-t-primary border-b-2'

  const isTitle = variant === 'title'

  // Map all options to flat index for refs (audience + circles + create)
  let optionIndex = -1

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={label}
        className={`flex items-center gap-2 transition-colors ${
          isTitle
            ? `font-display tracking-wide hover:text-primary ${open ? 'text-primary' : 'text-base-content'}`
            : `px-3 py-1.5 font-ui text-xs uppercase tracking-widest ${
                open ? 'bg-base-300 text-base-content' : 'bg-base-100 text-base-content/70 hover:bg-base-200'
              }`
        } ${className}`}
      >
        {isTitle && circle && <CircleAvatar circle={circle} size="w-9 h-9" />}
        {!isTitle && circle && <CircleAvatar circle={circle} size="w-4 h-4" />}
        <span className={isTitle ? 'text-3xl leading-none' : ''} aria-hidden="true">{label}</span>
        <ChevronDown className={`transition-transform ${isTitle ? 'w-5 h-5 mt-0.5' : 'w-3 h-3'} ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {/* Panel */}
      {open && (
        <div className={`absolute left-0 z-30 w-64 bg-base-100 border-x-2 border-base-300 shadow-lg ${panelPos}`}>

          {/* Search — combobox input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-base-300">
            <Search className="w-3 h-3 text-base-content/40 shrink-0" aria-hidden="true" />
            <input
              ref={searchRef}
              autoFocus
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={focusedIndex >= 0 ? `${id}-opt-${focusedIndex}` : undefined}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setFocusedIndex(-1) }}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('circle.searchPlaceholder')}
              className="flex-1 bg-transparent font-ui text-xs uppercase tracking-widest text-base-content placeholder:text-base-content/30 outline-none"
            />
          </div>

          <ul
            id={listboxId}
            role="listbox"
            aria-label={t('circle.searchPlaceholder')}
            className="max-h-72 overflow-y-auto"
          >
            {/* Audience options */}
            {showAudience && AUDIENCE_OPTIONS.map((opt) => {
              optionIndex++
              const i = optionIndex
              return (
                <li key={opt.id} role="option" aria-selected={value === opt.id} id={`${id}-opt-${i}`}>
                  <button
                    ref={(el) => { optionRefs.current[i] = el }}
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleSelect(opt.id)}
                    onKeyDown={(e) => handleOptionKeyDown(e, i)}
                    className={`w-full flex flex-col px-4 py-2.5 text-left transition-colors ${
                      value === opt.id
                        ? 'bg-secondary text-secondary-content'
                        : 'hover:bg-base-200 text-base-content'
                    }`}
                  >
                    <span className="font-ui text-xs uppercase tracking-widest">{opt.label}</span>
                    <span className={`font-reading text-xs mt-0.5 ${value === opt.id ? 'text-secondary-content/70' : 'text-base-content/40'}`}>
                      {opt.summary}
                    </span>
                  </button>
                </li>
              )
            })}

            {/* Divider */}
            {showAudience && circles.length > 0 && (
              <li className="border-t-2 border-base-300" role="separator" />
            )}

            {/* Empty state */}
            {filtered.length === 0 && (
              <li className="px-4 py-3 font-ui text-xs uppercase tracking-widest text-base-content/40" role="status">
                {t('circle.noResults')}
              </li>
            )}

            {/* Circles */}
            {filtered.map((circle) => {
              optionIndex++
              const i = optionIndex
              return (
                <li key={circle.id} role="option" aria-selected={value === circle.id} id={`${id}-opt-${i}`}>
                  <button
                    ref={(el) => { optionRefs.current[i] = el }}
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleSelect(circle.id)}
                    onKeyDown={(e) => handleOptionKeyDown(e, i)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                      value === circle.id
                        ? 'bg-secondary text-secondary-content'
                        : 'hover:bg-base-200 text-base-content'
                    }`}
                  >
                    <CircleAvatar circle={circle} size="w-5 h-5" />
                    <span className="flex flex-col min-w-0">
                      <span className="font-ui text-xs uppercase tracking-widest truncate">{circle.name}</span>
                      {circle.summary && (
                        <span className={`font-reading text-xs truncate ${value === circle.id ? 'text-secondary-content/70' : 'text-base-content/40'}`}>
                          {circle.summary}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}

            {/* Groups the user belongs to — always addressable, below circles (#67) */}
            {filteredGroups.length > 0 && (
              <li
                className="border-t-2 border-base-300 px-4 pt-2 pb-1 font-ui text-[10px] uppercase tracking-widest text-base-content/40"
                role="presentation"
              >
                {t('composer.groups', { defaultValue: 'Groups' })}
              </li>
            )}
            {filteredGroups.map((grp) => {
              optionIndex++
              const i = optionIndex
              return (
                <li key={grp.id} role="option" aria-selected={value === grp.id} id={`${id}-opt-${i}`}>
                  <button
                    ref={(el) => { optionRefs.current[i] = el }}
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleSelect(grp.id)}
                    onKeyDown={(e) => handleOptionKeyDown(e, i)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                      value === grp.id
                        ? 'bg-secondary text-secondary-content'
                        : 'hover:bg-base-200 text-base-content'
                    }`}
                  >
                    <GroupAvatar group={grp} size="w-5 h-5" />
                    <span className="font-ui text-xs uppercase tracking-widest truncate">{grp.name}</span>
                  </button>
                </li>
              )
            })}

            {/* Create new circle */}
            {allowCreate && (() => {
              optionIndex++
              const i = optionIndex
              return (
                <li key="__create__" className="border-t-2 border-base-300" role="option" aria-selected={false} id={`${id}-opt-${i}`}>
                  <button
                    ref={(el) => { optionRefs.current[i] = el }}
                    type="button"
                    tabIndex={-1}
                    onClick={() => { setOpen(false); onCreateCircle ? onCreateCircle() : navigate('/circles/new') }}
                    onKeyDown={(e) => handleOptionKeyDown(e, i)}
                    className="w-full px-4 py-2.5 text-left font-ui text-xs uppercase tracking-widest text-primary hover:bg-base-200 transition-colors"
                  >
                    {t('circle.new')}
                  </button>
                </li>
              )
            })()}
          </ul>
        </div>
      )}

    </div>
  )
}
