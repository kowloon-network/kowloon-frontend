// PostComposer — collapsed prompt that opens a full-screen modal editor.
// Collapsed: shows user avatar + prompt text.
// Expanded: modal overlay with type selector, rich text editor, audience picker, submit/cancel.
// Auth-aware: renders nothing if not logged in.

import { useState, useRef, useEffect, useMemo } from 'react'
import { sortByPins } from '@kowloon/client'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import FocusTrap from 'focus-trap-react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import MediaIcon from '../../assets/icons/post-media.svg?react'
import PostTypeIcon from '../ui/PostTypeIcon'
import { useClient } from '../../hooks/useClient'
import { useDraft } from '../../hooks/useDraft'
import { toast } from '../../app/toast'
import UserAvatar from '../ui/UserAvatar'
import { POST_TYPES, POST_TYPE_NAMES } from '../../lib/postTypes'
import RichTextEditor from './RichTextEditor'
import CircleSelector from '../circles/CircleSelector'
import { useJoinedGroups } from '../../hooks/useJoinedGroups'
import LocationField from './LocationField'
import AudioPlayer from '../ui/AudioPlayer'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage, faVideo, faMusic, faGripVertical } from '@fortawesome/free-solid-svg-icons'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const NOTE_MAX_WORDS = 500
const NOTE_MAX_CHARS = 5000

const countWords = (md) => md.trim().split(/\s+/).filter(Boolean).length

// Map a stored prefs/audience value ('@public', '@<domain>', a circle/group id)
// to the ids the web CircleSelector uses ('public' | 'server' | id). Prefs are
// stored in the canonical server form; the web picker predates it.
export function prefAudienceToWeb(val) {
  if (!val || val === '@public' || val === 'public') return 'public'
  if (val === 'server' || val === '@server') return 'server'
  if (/^@[^@]+$/.test(val)) return 'server' // bare @domain = this community
  return val // circle / group id, or a specific @user@domain (passed through)
}

// ── Reply/React scope ("Advanced") ───────────────────────────────────────────
// Collapsible pair of audience pickers for who may reply / react. Both track the
// post's audience until narrowed by hand (the parent resets them on audience
// change). Collapsed by default so the composer stays clean.

function ReplyReactScope({ audience, canReply, canReact, onChangeReply, onChangeReact, circles, groups }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const customized = canReply !== audience || canReact !== audience
  return (
    <div className="px-4 py-3 border-t-2 border-base-300 bg-base-100">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-base-content transition-colors"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {t('composer.advanced', { defaultValue: 'Advanced' })}
        {customized && (
          <span className="text-primary ml-1">{t('composer.customized', { defaultValue: 'Customized' })}</span>
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex items-center gap-3">
            <span className="font-ui text-xs uppercase tracking-widest text-base-content/50 w-28 shrink-0">
              {t('composer.whoCanReply', { defaultValue: 'Who can reply' })}
            </span>
            <CircleSelector circles={circles} groups={groups} value={canReply} onChange={onChangeReply} showAudience direction="up" />
          </div>
          <div className="flex items-center gap-3">
            <span className="font-ui text-xs uppercase tracking-widest text-base-content/50 w-28 shrink-0">
              {t('composer.whoCanReact', { defaultValue: 'Who can react' })}
            </span>
            <CircleSelector circles={circles} groups={groups} value={canReact} onChange={onChangeReact} showAudience direction="up" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tags input ─────────────────────────────────────────────────────────────

function TagsInput({ tags, onChange }) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')

  const commit = () => {
    const tag = input.trim().replace(/^#+/, '').toLowerCase()
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setInput('')
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b-2 border-base-300 bg-base-100 min-h-10">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-base-200 font-ui text-xs uppercase tracking-widest">
          #{tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            aria-label={`Remove #${tag}`}
            className="text-base-content/40 hover:text-error transition-colors leading-none ml-0.5"
          >
            &times;
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
          if (e.key === 'Backspace' && !input && tags.length) {
            onChange(tags.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={tags.length ? '' : t('composer.tagsPlaceholder')}
        aria-label={t('composer.tagsLabel')}
        className="flex-1 min-w-24 bg-transparent font-ui text-xs uppercase tracking-widest text-base-content placeholder:text-base-content/30 outline-none"
      />
    </div>
  )
}

// ── DateTimeField ──────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0')

function addOneHourToTime(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  return `${pad((h + 1) % 24)}:${pad(m)}`
}

// Split a stored datetime into local [date, time] form fields. Reads local
// components so it round-trips with joinDateTime (which stores a UTC instant),
// keeping event times from drifting by the viewer's offset (#63, web).
function splitDateTime(val) {
  if (!val) return ['', '']
  const d = new Date(val)
  if (isNaN(d.getTime())) {
    const [date, time] = String(val).split('T')
    return [date || '', (time || '').slice(0, 5)]
  }
  const pad = (n) => String(n).padStart(2, '0')
  return [
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  ]
}

// Build a UTC ISO instant from the local date+time fields. A bare
// "YYYY-MM-DDTHH:mm" has no zone, so the server read it as UTC and the display
// shifted it by the viewer's offset (#63). Encoding the real instant fixes it.
function joinDateTime(date, time) {
  if (!date) return ''
  const [y, mo, d] = String(date).split('-').map(Number)
  const [h, mi] = String(time || '00:00').split(':').map(Number)
  if (!y || !mo || !d) return time ? `${date}T${time}` : date
  const dt = new Date(y, mo - 1, d, h || 0, mi || 0, 0, 0)
  return isNaN(dt.getTime()) ? (time ? `${date}T${time}` : date) : dt.toISOString()
}

function DateTimeField({ dateValue, timeValue, onDateChange, onTimeChange, placeholder, ariaLabel, optional = false, borderRight = false }) {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)
  const dateRef = useRef(null)

  const hasValue = dateValue || timeValue
  const borderClass = borderRight ? 'border-r-2 border-base-300' : ''

  const handleActivate = () => {
    setActive(true)
    setTimeout(() => dateRef.current?.showPicker?.(), 0)
  }

  const handleBlur = () => {
    if (!dateValue && !timeValue) setActive(false)
  }

  if (!hasValue && !active) {
    return (
      <button
        type="button"
        onClick={handleActivate}
        aria-label={ariaLabel}
        className={`flex-1 flex items-center justify-between px-4 py-2.5 bg-base-100 font-ui text-sm uppercase tracking-widest text-base-content/40 hover:text-base-content/70 transition-colors text-left ${borderClass}`}
      >
        <span aria-hidden="true">{placeholder}</span>
        {optional && <span className="text-base-content/30 normal-case tracking-normal text-xs italic font-reading" aria-hidden="true">{t('common.optional')}</span>}
      </button>
    )
  }

  return (
    <div className={`flex-1 flex items-center bg-base-100 ${borderClass}`}>
      <input
        ref={dateRef}
        type="date"
        value={dateValue}
        onChange={(e) => onDateChange(e.target.value)}
        onBlur={handleBlur}
        autoFocus={!hasValue}
        aria-label={`${ariaLabel} date`}
        className="flex-1 px-4 py-2.5 font-ui text-sm text-base-content bg-transparent outline-none"
      />
      <input
        type="time"
        value={timeValue}
        onChange={(e) => onTimeChange(e.target.value)}
        onBlur={handleBlur}
        aria-label={`${ariaLabel} time`}
        className="px-4 py-2.5 font-ui text-sm text-base-content bg-transparent outline-none border-l border-base-300"
      />
    </div>
  )
}

// ── Attachment row (Media type) ────────────────────────────────────────────

function AttachmentPreview({ att }) {
  const mt = att.file.type
  if (mt.startsWith('image/')) {
    return (
      <img
        src={att.previewUrl}
        alt=""
        className="w-20 h-20 object-cover shrink-0 bg-base-300"
      />
    )
  }
  if (mt.startsWith('video/')) {
    return (
      <video
        src={att.previewUrl}
        className="w-20 h-20 object-cover shrink-0 bg-black"
        muted
        preload="metadata"
      />
    )
  }
  if (mt.startsWith('audio/')) {
    return <AudioPlayer src={att.previewUrl} className="w-20 h-20" />
  }
  return null
}

function SortableAttachmentRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.att.previewUrl })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <AttachmentRow {...props} dragHandleProps={{ ...attributes, ...listeners }} uploadError={props.uploadErrors?.[props.att.previewUrl]} />
    </div>
  )
}

function AttachmentRow({ att, index, onUpdate, onRemove, dragHandleProps = {}, uploadError }) {
  const { t } = useTranslation()
  const isAudio = att.file.type.startsWith('audio/')
  return (
    <div className={`flex gap-3 items-start py-4 border-b border-base-300 bg-base-100 ${isAudio ? 'flex-col' : ''} ${uploadError ? 'bg-error/5' : ''}`}>
      {/* Drag handle */}
      <button
        type="button"
        className="shrink-0 self-center px-2 py-1 text-base-content/25 hover:text-base-content/60 focus-visible:text-base-content/60 cursor-grab active:cursor-grabbing touch-none"
        aria-label={t('composer.dragToReorder')}
        aria-roledescription="sortable"
        {...dragHandleProps}
      >
        <FontAwesomeIcon icon={faGripVertical} />
      </button>
      {!isAudio && <AttachmentPreview att={att} />}
      <div className="flex flex-col gap-2.5 flex-1 min-w-0">
        {isAudio && <AttachmentPreview att={att} />}
        <input
          type="text"
          value={att.title}
          onChange={(e) => onUpdate(index, 'title', e.target.value)}
          placeholder={t('composer.attachmentTitle')}
          aria-label={t('composer.attachmentTitleLabel')}
          className="bg-transparent font-ui text-sm uppercase tracking-widest text-base-content placeholder:text-base-content/30 outline-none border-b border-base-300 pb-1"
        />
        <input
          type="text"
          value={att.alt}
          onChange={(e) => onUpdate(index, 'alt', e.target.value)}
          placeholder={t('composer.attachmentAlt')}
          aria-label={t('composer.attachmentAltLabel')}
          className="bg-transparent font-reading text-sm text-base-content/80 placeholder:text-base-content/40 outline-none"
        />
      </div>
      <div className="flex flex-col gap-2 items-end shrink-0 pt-0.5 pr-4">
        {uploadError && (
          <span className="font-ui text-xs uppercase tracking-widest text-error">{uploadError}</span>
        )}
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="font-ui text-xs uppercase tracking-widest text-base-content/30 hover:text-error transition-colors"
        >
          {t('composer.attachmentRemove')}
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function PostComposer({
  onPostCreated, onClose, initialValues = {}, defaultOpen = false, prompt, open, onOpenChange, hideTrigger = false,
  // lockType: pins postType to its initial value (used by e.g. a "Add Media"
  // deep-entry flow where switching types would be confusing/wrong).
  // mediaAccept: override the Media file input's accept filter.
  // autoOpenFilePicker: auto-trigger the Media file picker once on mount.
  lockType = false, mediaAccept = 'image/*,audio/*,video/*', autoOpenFilePicker = false,
}) {
  const { user } = useSelector((state) => state.auth)
  const { items: rawCircles } = useSelector((state) => state.myCircles)
  // Order circles by the user's pins so the audience picker matches everywhere.
  const myCircles = useMemo(
    () => sortByPins(rawCircles, user?.prefs?.pinnedCircles || []),
    [rawCircles, user?.prefs?.pinnedCircles]
  )
  const joinedGroups = useJoinedGroups() // groups are addressable too (#67)
  const geocodingUrl = useSelector((state) => state.server.settings?.geocodingUrl)
  const maxUploadSize = useSelector((state) => state.server.settings?.maxUploadSize) // MB
  const client = useClient()
  const { t } = useTranslation()

  const [expanded, setExpanded]       = useState(defaultOpen)
  const [postType, setPostType]       = useState(initialValues.type ?? user?.prefs?.defaultPostType ?? 'Note')
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [content, setContent]         = useState(initialValues.content  ?? '')
  const [title, setTitle]             = useState(initialValues.title    ?? '')
  const [href, setHref]               = useState(initialValues.href     ?? '')
  const [startDatePart, setStartDatePart] = useState(() => splitDateTime(initialValues.startDate)[0])
  const [startTimePart, setStartTimePart] = useState(() => splitDateTime(initialValues.startDate)[1])
  const [endDatePart,   setEndDatePart]   = useState(() => splitDateTime(initialValues.endDate)[0])
  const [endTimePart,   setEndTimePart]   = useState(() => splitDateTime(initialValues.endDate)[1])
  const startDate = joinDateTime(startDatePart, startTimePart)
  const endDate   = joinDateTime(endDatePart, endTimePart)
  const [tags, setTags]               = useState(initialValues.tags     ?? [])
  const [location, setLocation]       = useState(initialValues.location ?? '')
  const [attachments, setAttachments] = useState([])   // [{ file, title, alt, previewUrl }]
  const [featuredImage, setFeaturedImage] = useState(initialValues.featuredImage ?? null) // URL or file ID from link/article preview
  const [artFeaturedFile, setArtFeaturedFile]       = useState(null)    // File for Article featured image
  const [artFeaturedPreview, setArtFeaturedPreview] = useState(null)    // object URL preview
  const [uploadErrors, setUploadErrors] = useState({}) // previewUrl → error string
  const [target, setTarget]           = useState(initialValues.target ?? null) // ID of post being shared
  const [geo, setGeo]                 = useState(null) // { lat, lon } from browser
  const [locating, setLocating]       = useState(false)
  // Audience: an explicit prefill wins; otherwise fall back to the user's
  // composing default (prefs.defaultTo).
  const paramAudience = initialValues.to ?? initialValues.audience ?? null
  const [audience, setAudience]       = useState(paramAudience ?? prefAudienceToWeb(user?.prefs?.defaultTo))
  // Reply/react scope — track the post audience until narrowed by hand. When the
  // audience came from a prefill param, track it; otherwise seed from the user's
  // defaultcanReply/defaultcanReact composing prefs.
  const [canReply, setCanReply]       = useState(paramAudience ? (paramAudience) : prefAudienceToWeb(user?.prefs?.defaultcanReply))
  const [canReact, setCanReact]       = useState(paramAudience ? (paramAudience) : prefAudienceToWeb(user?.prefs?.defaultcanReact))
  const [linkPreview, setLinkPreview] = useState(null) // { title, summary, image } from /preview
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState(null)
  const [editorKey, setEditorKey]     = useState(0)
  const [fetchingMeta, setFetchingMeta] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)

  const composerRef      = useRef(null)
  const photoInputRef    = useRef(null)
  const videoInputRef    = useRef(null)
  const audioInputRef    = useRef(null)

  // One single-type-accept input + button per media kind mediaAccept
  // actually includes — issue #60. Originally just split visual (image+video
  // combined) from audio, since a broad multi-type accept with no capture
  // hint is what produces Android's ambiguous native chooser. That wasn't
  // enough: confirmed live on a real Android phone that accept="image/*,
  // video/*" ALONE still falls back to the full "Choose an action" chooser
  // (Camera / Camera Camcorder / Files) — Chromium's fast single-tap Android
  // Photo Picker only kicks in when accept resolves to exactly one clean
  // type. A clean audio/*-only input, by contrast, opened straight into file
  // selection with no chooser at all. So photo and video need their own
  // buttons too, not just their own shared one. A caller that narrows
  // mediaAccept to a single kind (e.g. PicsComposeFab's image-only) still
  // gets exactly the one button for that kind — nothing to split there.
  const ALL_MEDIA_KINDS = [
    { key: 'image', accept: 'image/*', ref: photoInputRef, icon: faImage, label: 'composer.addPhoto',  defaultLabel: 'Photo' },
    { key: 'video', accept: 'video/*', ref: videoInputRef, icon: faVideo, label: 'composer.addVideo',  defaultLabel: 'Video' },
    { key: 'audio', accept: 'audio/*', ref: audioInputRef, icon: faMusic, label: 'composer.addAudio',  defaultLabel: 'Audio' },
  ]
  const mediaKinds = ALL_MEDIA_KINDS.filter(
    (k) => new RegExp(`(^|,)\\s*${k.key}/`).test(mediaAccept)
  )
  const artImageInputRef = useRef(null)
  const hrefInputRef     = useRef(null)
  // The href we've already auto-filled title/featured/body from, so a later
  // re-fetch never re-injects what the user has since edited or deleted.
  const autoFilledHrefRef = useRef(null)
  const triggerRef       = useRef(null)
  const typeDropdownRef  = useRef(null)
  const popupHostRef     = useRef(null)
  const prevOpenRef      = useRef(open)

  // Idempotency key for retry-safe submission. Reused across retries of the
  // same content (e.g. mobile signal drops mid-submit) so the server's
  // dedupeKey lookup short-circuits duplicate posts. Regenerated when the
  // user materially changes the post body/title/audience/etc.
  const dedupeRef = useRef(null)

  // Draft persistence — survives tab close, app switch, browser crash.
  // Skipped in prefilled/share mode where the composer is opened with content
  // from the caller (sharing a post, prefilled Link, edit-in-place).
  const isPrefilled = defaultOpen
    || initialValues.content
    || initialValues.href
    || initialValues.target
    || initialValues.title
  // Locked-type instances (e.g. a Media-only deep entry) skip the shared
  // draft entirely — they'd otherwise read/write the same `post:${user.id}`
  // key as the normal composer and cross-contaminate its saved postType.
  const draftKey = user && !isPrefilled && !lockType ? `post:${user.id}` : null
  const draft = useDraft(draftKey)
  const draftRestoredRef = useRef(false)

  const wordCount = postType === 'Note' ? countWords(content) : 0
  const charCount = postType === 'Note' ? content.length : 0
  const atNoteLimit = postType === 'Note' && (wordCount >= NOTE_MAX_WORDS || charCount >= NOTE_MAX_CHARS)
  const noteWarn = postType === 'Note' && (wordCount >= 450 || charCount >= 4500)

  const hasTitle    = postType !== 'Note'
  const hasTags     = postType !== 'Note'
  const canPost     = !submitting && !atNoteLimit &&
    (content.trim() || (postType === 'Event' && startDate) || (postType === 'Media' && attachments.length))

  const handleTypeChange = (newType) => {
    if (newType === 'Note' && postType !== 'Note') {
      const words = content.trim().split(/\s+/).filter(Boolean)
      if (words.length > NOTE_MAX_WORDS) {
        setContent(words.slice(0, NOTE_MAX_WORDS).join(' '))
        setEditorKey((k) => k + 1)
      }
    }
    setPostType(newType)
    if (newType === 'Link') {
      setTimeout(() => hrefInputRef.current?.focus(), 0)
    }
  }

  // Controlled-open mode: when a parent drives `open` (e.g. the floating
  // ComposeFab), mirror its transitions onto `expanded`. We react only to
  // CHANGES in `open` — not its steady value — so the draft-reopen effect
  // below can still open the composer on its own without being clobbered.
  useEffect(() => {
    if (open === undefined) return
    if (open !== prevOpenRef.current) {
      prevOpenRef.current = open
      setExpanded(open)
      // Preset the post type chosen in the FAB's picker when opened externally.
      if (open && initialValues.type) setPostType(initialValues.type)
    }
  }, [open])

  // Collapse on outside click (collapsed state only)
  useEffect(() => {
    function handleClick(e) {
      if (composerRef.current && !composerRef.current.contains(e.target)) {
        if (!content && !title && !href) setExpanded(false)
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [content, title, href])

  // Lock body scroll, handle Escape, and track keyboard height when modal is open
  useEffect(() => {
    if (!expanded) return
    document.body.style.overflow = 'hidden'
    const handleKey = (e) => { if (e.key === 'Escape') handleCancel() }
    document.addEventListener('keydown', handleKey)

    // Shrink modal when on-screen keyboard appears
    const vv = window.visualViewport
    const updateKeyboard = () => {
      if (!vv) return
      setKeyboardHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    vv?.addEventListener('resize', updateKeyboard)
    updateKeyboard()

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKey)
      vv?.removeEventListener('resize', updateKeyboard)
      setKeyboardHeight(0)
    }
  }, [expanded])

  // Restore saved draft when the modal opens.
  useEffect(() => {
    if (!expanded) {
      draftRestoredRef.current = false
      return
    }
    if (draftRestoredRef.current || !draftKey) return
    draftRestoredRef.current = true
    const saved = draft.load()
    if (!saved) return
    // lockType wins over a stale draft — postType must never move away from
    // its initial value while locked, even if draftKey isolation is bypassed.
    if (saved.postType && !lockType) setPostType(saved.postType)
    if (saved.content) setContent(saved.content)
    if (saved.title) setTitle(saved.title)
    if (saved.href) setHref(saved.href)
    if (saved.tags?.length) setTags(saved.tags)
    if (saved.location) setLocation(saved.location)
    if (saved.audience) setAudience(saved.audience)
    if (saved.startDatePart) setStartDatePart(saved.startDatePart)
    if (saved.startTimePart) setStartTimePart(saved.startTimePart)
    if (saved.endDatePart) setEndDatePart(saved.endDatePart)
    if (saved.endTimePart) setEndTimePart(saved.endTimePart)
    if (saved.featuredImage) setFeaturedImage(saved.featuredImage)
    // Bump editor key so RichTextEditor picks up restored content.
    if (saved.content) setEditorKey((k) => k + 1)
  }, [expanded, draftKey, draft])

  // Persist draft on field changes (debounced inside useDraft). We stash
  // `expanded: true` alongside the content so a page reload can reopen the
  // composer right where the user left it.
  useEffect(() => {
    if (!expanded || !draftKey || !draftRestoredRef.current) return
    const hasContent = content.trim() || title.trim() || href.trim()
      || tags.length || location || startDatePart || endDatePart
    if (!hasContent) {
      // Drop any pending debounced write so a momentarily-empty state
      // doesn't get persisted, but keep the stored draft (only Cancel
      // discards explicitly).
      draft.cancel()
      return
    }
    draft.save({
      expanded: true,
      postType, content, title, href, tags, location, audience,
      startDatePart, startTimePart, endDatePart, endTimePart, featuredImage,
    })
  }, [
    expanded, draftKey, draft,
    postType, content, title, href, tags, location, audience,
    startDatePart, startTimePart, endDatePart, endTimePart, featuredImage,
  ])

  // On mount, reopen the composer if the user had it open with unsaved
  // content. The existing restore effect (above) will populate the fields
  // when `expanded` flips true.
  useEffect(() => {
    if (isPrefilled || !draftKey) return
    const saved = draft.load()
    if (saved?.expanded) setExpanded(true)
    // Run once on mount — no deps on `draft` or `draftKey` so navigation
    // between pages with the same composer doesn't re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const autoOpenedFilePickerRef = useRef(false)

  // Auto-open the native file picker for a Media deep-entry flow. Must fire
  // synchronously in the effect body (NOT via setTimeout, even 0ms) — some
  // browsers only allow window.showOpenFilePicker-style dialogs to open
  // within the same tick as the user gesture that led here, and a deferred
  // callback breaks that chain. Guarded by a ref so it only ever fires once
  // per mount, not on every re-render or every `expanded` transition.
  useEffect(() => {
    if (!autoOpenFilePicker || autoOpenedFilePickerRef.current) return
    if (!expanded || postType !== 'Media') return
    autoOpenedFilePickerRef.current = true
    // The only current caller (PicsComposeFab) narrows mediaAccept to
    // image-only, so this is always the right (and only rendered) input.
    photoInputRef.current?.click()
  }, [autoOpenFilePicker, expanded, postType])

  const handleCancel = () => {
    draft.clear()
    dedupeRef.current = null
    setExpanded(false)
    setTimeout(() => triggerRef.current?.focus(), 0)
    setContent('')
    setTitle('')
    setHref('')
    autoFilledHrefRef.current = null
    setStartDatePart('')
    setStartTimePart('')
    setEndDatePart('')
    setEndTimePart('')
    setTags([])
    setLocation('')
    setGeo(null)
    setAttachments((prev) => { prev.forEach((a) => URL.revokeObjectURL(a.previewUrl)); return [] })
    setFeaturedImage(null)
    if (artFeaturedPreview) { URL.revokeObjectURL(artFeaturedPreview); setArtFeaturedPreview(null) }
    setArtFeaturedFile(null)
    setUploadErrors({})
    setTarget(null)
    setPostType('Note')
    setTypeMenuOpen(false)
    setAudience('public')
    setCanReply('public')
    setCanReact('public')
    setLinkPreview(null)
    setError(null)
    onClose?.()
    // Keep controlled parents (ComposeFab) in sync when we close ourselves.
    prevOpenRef.current = false
    onOpenChange?.(false)
  }

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setLocation('Location unavailable')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lon } = coords
        setGeo({ lat, lon })
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'kowloon-frontend/1.0' } }
          )
          const data = await res.json()
          const place = data.address
          const parts = [
            place.city || place.town || place.village || place.county,
            place.state,
            place.country_code?.toUpperCase(),
          ].filter(Boolean)
          setLocation(parts.join(', '))
        } catch {
          setLocation(`${lat.toFixed(4)}, ${lon.toFixed(4)}`)
        } finally {
          setLocating(false)
        }
      },
      (err) => {
        setLocating(false)
        if (err.code === err.PERMISSION_DENIED) setLocation('Location access denied')
        else setLocation('Location unavailable')
      },
      { timeout: 8000 }
    )
  }

  // Auto-fetch link metadata for a given URL. Sets the preview card, auto-fills
  // a blank title, adopts the OG image as the featured image, and drops the
  // source summary into an empty body as a blockquote (matches mobile compose.js).
  const fetchLinkMeta = async (url) => {
    if (!url || !client) return
    try { new URL(url) } catch { return }
    setFetchingMeta(true)
    try {
      const meta = await client.feeds.getLinkPreview({ url })
      setLinkPreview(meta || null)
      // Auto-fill once per URL. The card (setLinkPreview) always refreshes, but
      // title/featured/body are seeded a single time — otherwise deleting the
      // quoted body (or the featured image) is undone by the next re-fetch,
      // which re-injects it because the field is empty again.
      if (meta && autoFilledHrefRef.current !== url) {
        autoFilledHrefRef.current = url
        if (meta.title && !title) setTitle(meta.title)
        if (meta.image && !featuredImage) setFeaturedImage(meta.image)
        if (meta.summary && !content.trim()) {
          const quoted = meta.summary.trim().split(/\n+/).map((l) => `> ${l}`).join('\n')
          setContent(`${quoted}\n\n`)
          setEditorKey((k) => k + 1) // RichTextEditor only reads `content` on mount
        }
      }
    } catch {}
    finally { setFetchingMeta(false) }
  }

  // Live link preview — debounced as the URL is typed/pasted (not just on blur).
  useEffect(() => {
    if (postType !== 'Link' || !href.trim()) {
      setLinkPreview(null)
      autoFilledHrefRef.current = null
      return
    }
    const timer = setTimeout(() => fetchLinkMeta(href.trim()), 600)
    return () => clearTimeout(timer)
    // fetchLinkMeta reads title/content/featuredImage from the closure; we only
    // want to re-run on href / type change (autofill-once semantics).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, postType, client])

  // Trigger preview immediately when a URL is pasted into the href field; the
  // debounced effect above then fetches it.
  const handleHrefPaste = (e) => {
    const text = (e.clipboardData?.getData('text') ?? '').trim()
    if (/^https?:\/\/\S+/i.test(text)) {
      setHref(text)
      e.preventDefault()
    }
  }

  // Per-server upload ceiling (MB → bytes); Infinity until the server profile
  // loads. Oversized picks are rejected up front, before a doomed upload.
  const maxUploadBytes = maxUploadSize > 0 ? maxUploadSize * 1024 * 1024 : Infinity
  const tooLargeMessage = (names) =>
    t('composer.fileTooLarge', {
      defaultValue: `${names} exceeds this server's ${maxUploadSize} MB upload limit.`,
      names,
      limit: maxUploadSize,
    })

  const handleArtImageFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxUploadBytes) {
      setError(tooLargeMessage(file.name))
      e.target.value = ''
      return
    }
    if (artFeaturedPreview) URL.revokeObjectURL(artFeaturedPreview)
    setArtFeaturedFile(file)
    setArtFeaturedPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleFileAdd = (e) => {
    const files = Array.from(e.target.files)
    const tooBig = files.filter((f) => f.size > maxUploadBytes)
    const ok = files.filter((f) => f.size <= maxUploadBytes)
    if (tooBig.length) setError(tooLargeMessage(tooBig.map((f) => f.name).join(', ')))
    else setError(null)
    if (ok.length) {
      setAttachments((prev) => [
        ...prev,
        ...ok.map((f) => ({
          file: f,
          // Deliberately not pre-filled from the filename — nobody wants
          // "IMG_4213" as their caption, and it reads as a UI mistake.
          title: '',
          alt: '',
          previewUrl: URL.createObjectURL(f),
        })),
      ])
    }
    e.target.value = ''
  }

  const updateAttachment = (i, field, value) =>
    setAttachments((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleAttachmentDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setAttachments((prev) => {
      const oldIndex = prev.findIndex((a) => a.previewUrl === active.id)
      const newIndex = prev.findIndex((a) => a.previewUrl === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const removeAttachment = (i) => {
    setAttachments((prev) => {
      URL.revokeObjectURL(prev[i].previewUrl)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    setUploadErrors({})
    // Reuse the same dedupeKey across retries of the same content. The
    // signature covers every user-visible field; changing any of them is a
    // "different post" and gets a fresh key. Attachment file names are
    // included so swapping attachments invalidates the key, but the underlying
    // File objects are not (they aren't structurally comparable).
    const signature = JSON.stringify({
      postType, content, title, href, tags, location, audience,
      startDate, endDate, target,
      attachmentNames: attachments.map((a) => a.file.name),
    })
    if (!dedupeRef.current || dedupeRef.current.signature !== signature) {
      const key = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
      dedupeRef.current = { key, signature }
    }
    try {
      let uploadedAttachments
      let uploadedFeaturedImage = featuredImage || undefined

      // Upload Article/Event featured image if a file was selected
      if ((postType === 'Article' || postType === 'Event') && artFeaturedFile) {
        const res = await client.files.upload({
          file: artFeaturedFile,
          filename: artFeaturedFile.name,
          contentType: artFeaturedFile.type,
          to: audience,
        })
        if (res?.file?.id) uploadedFeaturedImage = res.file.id
      }

      // Upload Media attachments before creating the post
      if (postType === 'Media' && attachments.length > 0) {
        const results = await Promise.allSettled(
          attachments.map((att) =>
            client.files.upload({
              file: att.file,
              filename: att.file.name,
              contentType: att.file.type,
              title: att.title || undefined,
              summary: att.alt || undefined,
              to: audience,
            })
          )
        )
        // Surface per-attachment errors
        const errors = {}
        results.forEach((r, i) => {
          if (r.status === 'rejected') errors[attachments[i].previewUrl] = r.reason?.message ?? 'Upload failed'
        })
        if (Object.keys(errors).length > 0) {
          setUploadErrors(errors)
          setSubmitting(false)
          return
        }
        uploadedAttachments = results.map((r, i) => ({
          fileId: r.value.file.id,
          title: attachments[i].title || undefined,
          alt: attachments[i].alt || undefined,
        }))
      }

      const result = await client.activities.createPost({
        type: postType,
        title: title || undefined,
        content: content || undefined,
        href: href || undefined,
        startTime: startDate || undefined,
        endTime: endDate || undefined,
        tags: tags.length ? tags : undefined,
        location: location
          ? { type: 'Place', name: location, ...(geo ?? {}) }
          : undefined,
        to: audience,
        canReply,
        canReact,
        attachments: uploadedAttachments,
        featuredImage: uploadedFeaturedImage,
        target: target || undefined,
        dedupeKey: dedupeRef.current.key,
      })
      handleCancel()
      onPostCreated?.()
      // POST /outbox sets createdId at the top of the response; fall back
      // to other shapes for safety.
      const newPostId = result?.createdId
        ?? result?.result?.created?.id
        ?? result?.result?.id
        ?? result?.activity?.object?.id
      toast.success(
        t('composer.postedToast', { defaultValue: 'Post created' }),
        newPostId
          ? { action: { label: t('composer.viewPost', { defaultValue: 'View post' }), to: `/posts/${encodeURIComponent(newPostId)}` } }
          : undefined,
      )
    } catch (err) {
      setError(err.message || 'Failed to post.')
      toast.error(t('composer.postFailed', { defaultValue: 'Failed to post' }), { detail: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Split button trigger — hidden in onClose (share) mode and whenever the
          composer is opened externally (hideTrigger, e.g. the ComposeFab). */}
      {!hideTrigger && !onClose && !expanded && (
        <div className="flex justify-center mb-8">
          <div ref={typeDropdownRef} className="relative inline-flex">
            {/* Shared border frame wrapping both halves */}
            <div className="inline-flex border-2 border-base-content hover:border-primary transition-colors group">
            {/* Left: Create New */}
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setExpanded(true)}
              className="flex items-center gap-2 px-5 py-3 bg-base-100 text-base-content group-hover:text-primary font-ui text-xs font-bold uppercase tracking-widest transition-colors"
            >
              <Plus size={13} />
              Create New
            </button>

            {/* Thin internal separator */}
            <div className="w-px bg-base-300 self-stretch" />

            {/* Right: Type selector — disabled/no-op while lockType pins the
                post type (e.g. a Media-only deep entry). */}
            <button
              type="button"
              onClick={() => { if (!lockType) setTypeDropdownOpen((v) => !v) }}
              disabled={lockType}
              className="flex items-center gap-2 px-4 py-3 bg-base-100 text-base-content font-ui text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-60 disabled:cursor-default"
              aria-haspopup="listbox"
              aria-expanded={typeDropdownOpen}
            >
              <PostTypeIcon type={postType} size="sm" />
              <span style={{ color: POST_TYPES[postType]?.color ?? 'inherit' }}>{postType}</span>
              {!lockType && <ChevronDown size={11} className="opacity-50 ml-0.5" />}
            </button>
            </div>{/* end shared border frame */}

            {/* Type dropdown — left-aligned to the full button group. Belt-and-
                suspenders: never rendered while lockType is set, even if
                typeDropdownOpen was somehow left true. */}
            {typeDropdownOpen && !lockType && (
              <div
                role="listbox"
                className="absolute top-full left-0 mt-0.5 bg-base-100 border-2 border-base-300 z-[200] min-w-full shadow-lg"
              >
                {Object.keys(POST_TYPES).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="option"
                    aria-selected={type === postType}
                    onClick={() => {
                      setPostType(type)
                      setTypeDropdownOpen(false)
                      setExpanded(true)
                    }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors text-left ${type === postType ? 'bg-base-200' : ''}`}
                  >
                    <PostTypeIcon type={type} size="sm" />
                    <span style={{ color: POST_TYPES[type]?.color }}>{type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal portal */}
      {createPortal(
        <AnimatePresence>
          {expanded && (
            <FocusTrap focusTrapOptions={{ escapeDeactivates: false }}>
            <div
              className="fixed inset-x-0 top-0 z-50 flex flex-col"
              style={{ bottom: `${keyboardHeight}px` }}
            >

              {/* Backdrop */}
              <motion.div
                className="absolute inset-0 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.43 }}
                onClick={handleCancel}
              />

      {/* Panel — full-screen on mobile (like the app). At the lg: breakpoint,
          constrained to the same 6/12 grid column as the main content in
          Layout.jsx (col-start-4/col-span-6 of the same 12-col + gap-10 + px-4
          grid), so it lines up with the reading column instead of the sidebars.
          pointer-events-none on the grid wrapper lets clicks in the exposed
          gutters fall through to the backdrop's onClick={handleCancel}. */}
      <div className="relative flex-1 min-h-0 lg:px-4 pointer-events-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-16 h-full">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('composer.prompt')}
            className="relative flex flex-col w-full h-full min-h-0 bg-base-100 overflow-hidden pointer-events-auto lg:col-start-4 lg:col-span-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.47, ease: [0.25, 0.1, 0.25, 1] }}
          >

        {/* Header — the type is a dropdown ("Add New [Type] ▼"), like the app.
            This replaces the old tab row, which overflowed the mobile width and
            hid Event, making Events uncreatable. */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-base-300 bg-base-200 shrink-0">
          <div className="relative">
            {/* lockType pins the post type — the menu never opens, so the
                caller's initial type (e.g. Media) can't be switched away from. */}
            <button
              type="button"
              onClick={() => { if (!lockType) setTypeMenuOpen((o) => !o) }}
              disabled={lockType}
              aria-haspopup="listbox"
              aria-expanded={typeMenuOpen}
              className="flex items-center gap-2 font-display text-xl tracking-wide disabled:cursor-default"
            >
              <PostTypeIcon type={postType} size="sm" />
              {t('composer.addNew', { defaultValue: 'Add New' })}{' '}
              <span style={{ color: POST_TYPES[postType]?.color }}>
                {t(`postTypes.${postType}`, { defaultValue: postType })}
              </span>
              {!lockType && <ChevronDown size={18} className={`transition-transform ${typeMenuOpen ? 'rotate-180' : ''}`} />}
            </button>
            {/* Belt-and-suspenders: never rendered while locked, even if
                typeMenuOpen was somehow left true. */}
            {typeMenuOpen && !lockType && (
              <ul
                role="listbox"
                className="absolute left-0 top-full mt-1 z-10 w-52 bg-base-100 border-2 border-base-300 shadow-lg"
              >
                {POST_TYPE_NAMES.map((type) => (
                  <li key={type}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={type === postType}
                      onClick={() => { handleTypeChange(type); setTypeMenuOpen(false) }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 font-ui text-xs uppercase tracking-widest text-left transition-colors hover:bg-base-200 ${type === postType ? 'bg-base-200' : ''}`}
                    >
                      <PostTypeIcon type={type} size="sm" />
                      <span style={{ color: type === postType ? POST_TYPES[type]?.color : undefined }} className={type === postType ? '' : 'text-base-content/70'}>
                        {t(`postTypes.${type}`, { defaultValue: type })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={handleCancel}
            aria-label={t('composer.close')}
            className="px-4 py-2 font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-base-content transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body — min-h-0 is required for flex children to shrink correctly */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">

          {/* Media file picker — shown first so adding a photo/clip is the first action */}
          {postType === 'Media' && (
            <div className="border-b-2 border-base-300">
              {/* One single-type-accept button per media kind mediaAccept
                  includes — see the mediaKinds derivation above for why a
                  combined image+video accept isn't good enough on its own. */}
              {attachments.length === 0 ? (
                <div className="flex">
                  {mediaKinds.map((k, i) => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => k.ref.current?.click()}
                      className={`flex-1 flex items-center justify-center gap-3 py-8 bg-base-200 hover:bg-base-300 transition-colors font-ui text-sm uppercase tracking-widest text-base-content/60 hover:text-base-content cursor-pointer ${i < mediaKinds.length - 1 ? 'border-r border-base-300' : ''}`}
                    >
                      <FontAwesomeIcon icon={k.icon} className="text-lg" />
                      {t(k.label, { defaultValue: k.defaultLabel })}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAttachmentDragEnd}>
                    <SortableContext items={attachments.map((a) => a.previewUrl)} strategy={verticalListSortingStrategy}>
                      {attachments.map((att, i) => (
                        <SortableAttachmentRow key={att.previewUrl} att={att} index={i}
                          onUpdate={updateAttachment} onRemove={removeAttachment}
                          uploadErrors={uploadErrors} />
                      ))}
                    </SortableContext>
                  </DndContext>
                  <div className="flex border-t border-base-300">
                    {mediaKinds.map((k, i) => (
                      <button key={k.key} type="button" onClick={() => k.ref.current?.click()}
                        className={`flex-1 px-4 py-2.5 font-ui text-xs uppercase tracking-widest text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors text-center ${i < mediaKinds.length - 1 ? 'border-r border-base-300' : ''}`}>
                        {t(k.label, { defaultValue: k.defaultLabel })}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {mediaKinds.map((k) => (
                <input key={k.key} ref={k.ref} type="file" multiple accept={k.accept} className="hidden" onChange={handleFileAdd} />
              ))}
            </div>
          )}

          {/* Link URL — first field for Link type, same size as title */}
          {postType === 'Link' && (
            <div className={`flex items-center border-b-2 border-base-300 bg-base-100 ${fetchingMeta ? 'opacity-50' : ''}`}>
              <input
                ref={hrefInputRef}
                type="url"
                aria-label={t('composer.linkUrlLabel')}
                placeholder={t('composer.linkUrl')}
                value={href}
                onChange={(e) => setHref(e.target.value)}
                onPaste={handleHrefPaste}
                onBlur={() => fetchLinkMeta(href)}
                disabled={!!initialValues.href}
                className={`flex-1 px-4 py-3 bg-transparent font-display text-2xl tracking-wide text-base-content placeholder:text-base-content/30 outline-none min-w-0 ${initialValues.href ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
              {!href && !initialValues.href && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = (await navigator.clipboard.readText())?.trim()
                      if (text) setHref(text)
                    } catch {}
                  }}
                  className="shrink-0 px-3 py-1.5 mx-2 font-ui text-xs uppercase tracking-widest bg-base-200 hover:bg-base-300 text-base-content/60 hover:text-base-content transition-colors"
                >
                  {t('composer.linkPaste')}
                </button>
              )}
            </div>
          )}

          {/* Link OG preview card — thumbnail + title + summary, live-fetched
              from /preview as the URL is typed. The featured image (OG image or
              a repost's hero) is removable independently. */}
          {postType === 'Link' && (fetchingMeta || linkPreview || featuredImage) && (
            <div className="flex gap-3 items-start p-3 border-b-2 border-base-300 bg-base-200">
              {featuredImage ? (
                <img src={featuredImage} alt="" className="w-20 h-20 object-cover shrink-0 bg-base-300" />
              ) : linkPreview?.image ? (
                <img src={linkPreview.image} alt="" className="w-20 h-20 object-cover shrink-0 bg-base-300" />
              ) : (
                <div className="w-20 h-20 shrink-0 bg-base-300" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-ui text-[10px] uppercase tracking-widest text-base-content/40">
                    {fetchingMeta
                      ? t('common.loading', { defaultValue: 'Loading…' })
                      : t('composer.linkPreview', { defaultValue: 'Preview' })}
                  </span>
                  {featuredImage && (
                    <button
                      type="button"
                      onClick={() => setFeaturedImage(null)}
                      aria-label={t('composer.removeFeaturedImage', { defaultValue: 'Remove image' })}
                      className="font-ui text-[10px] uppercase tracking-widest text-base-content/40 hover:text-error transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="font-ui text-sm text-base-content mt-0.5 line-clamp-2">
                  {linkPreview?.title || title || t('composer.untitled', { defaultValue: 'Untitled' })}
                </p>
                {linkPreview?.summary && (
                  <p className="font-reading text-xs text-base-content/60 mt-0.5 line-clamp-2">
                    {linkPreview.summary}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Title — Article, Event, Link, Media */}
          {hasTitle && (
            <input
              type="text"
              aria-label={t('composer.titleLabel')}
              placeholder={t('composer.title')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-base-100 font-display text-2xl tracking-wide text-base-content placeholder:text-base-content/30 outline-none border-b-2 border-base-300"
            />
          )}

          {/* Article / Event featured image */}
          {(postType === 'Article' || postType === 'Event') && (
            <div className="border-b-2 border-base-300">
              {artFeaturedPreview ? (
                <div className="relative">
                  <img src={artFeaturedPreview} alt="" className="w-full max-h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => { URL.revokeObjectURL(artFeaturedPreview); setArtFeaturedPreview(null); setArtFeaturedFile(null) }}
                    aria-label={t('composer.removeFeaturedImage', { defaultValue: 'Remove image' })}
                    className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white font-ui text-xs uppercase tracking-widest hover:bg-black/70 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => artImageInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-4 py-2.5 font-ui text-xs uppercase tracking-widest text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors"
                >
                  <MediaIcon className="w-3 h-3" />
                  {t('composer.addFeaturedImage', { defaultValue: 'Add featured image' })}
                </button>
              )}
              <input ref={artImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleArtImageFile} />
            </div>
          )}

          {/* Event datetimes + location */}
          {postType === 'Event' && (
            <>
              <div className="flex border-b-2 border-base-300">
                <DateTimeField
                  dateValue={startDatePart}
                  timeValue={startTimePart}
                  onDateChange={(date) => {
                    setStartDatePart(date)
                    setEndDatePart(date)
                    if (date && !startTimePart) {
                      const now = new Date()
                      const h = now.getMinutes() > 0 ? (now.getHours() + 1) % 24 : now.getHours()
                      const rounded = `${pad(h)}:00`
                      setStartTimePart(rounded)
                      setEndTimePart(addOneHourToTime(rounded))
                    }
                  }}
                  onTimeChange={(time) => {
                    setStartTimePart(time)
                    if (time) setEndTimePart(addOneHourToTime(time))
                  }}
                  placeholder={t('composer.startDate')}
                  ariaLabel={t('composer.startDateLabel')}
                  borderRight
                />
                <DateTimeField
                  dateValue={endDatePart}
                  timeValue={endTimePart}
                  onDateChange={setEndDatePart}
                  onTimeChange={setEndTimePart}
                  placeholder={t('composer.endDate')}
                  ariaLabel={t('composer.endDateLabel')}
                  optional
                />
              </div>
              <LocationField
                value={location}
                onChange={setLocation}
                geo={geo}
                onGeoSelect={setGeo}
                locating={locating}
                onGeolocate={handleGeolocate}
                geocodingUrl={geocodingUrl}
                popupHostRef={popupHostRef}
              />
            </>
          )}

          {/* Rich text editor — no extra wrapper, editor fills the space */}
          <RichTextEditor
            key={editorKey}
            content={content}
            onChange={setContent}
            maxWords={postType === 'Note' ? NOTE_MAX_WORDS : undefined}
            postType={postType}
            // Only autofocus the body for Notes — for other types it sits below
            // the title + type fields (URL/image/date), and focusing it scrolls
            // those out of view.
            autoFocus={postType === 'Note'}
            editorClassName="min-h-[40vh]"
          />

          {/* Tags */}
          {hasTags && <TagsInput tags={tags} onChange={setTags} />}

          {/* Location — all types except Event */}
          {postType !== 'Event' && (
            <LocationField
              value={location}
              onChange={setLocation}
              geo={geo}
              onGeoSelect={setGeo}
              locating={locating}
              onGeolocate={handleGeolocate}
              geocodingUrl={geocodingUrl}
              popupHostRef={popupHostRef}
              borderTop
            />
          )}

          {/* Advanced — who can reply / react. Seeded from the audience above. */}
          <ReplyReactScope
            audience={audience}
            canReply={canReply}
            canReact={canReact}
            onChangeReply={setCanReply}
            onChangeReact={setCanReact}
            circles={myCircles}
            groups={joinedGroups}
          />

        </div>

        {/* Footer — pinned to bottom, never scrolls away */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 bg-base-200 border-t-2 border-base-300 shrink-0">
          <CircleSelector circles={myCircles} groups={joinedGroups} value={audience} onChange={(v) => { setAudience(v); setCanReply(v); setCanReact(v) }} showAudience allowCreate direction="up" constrain={initialValues.constrain} />
          <div className="flex items-center gap-3">
            {error && <span role="alert" aria-live="assertive" className="font-ui text-xs uppercase tracking-widest text-error">{error}</span>}
            {postType === 'Note' && (
              <span className={`font-ui text-xs uppercase tracking-widest tabular-nums ${atNoteLimit ? 'text-error' : noteWarn ? 'text-warning' : 'text-base-content/30'}`}>
                {t('composer.wordCount', { count: wordCount, max: NOTE_MAX_WORDS })}
              </span>
            )}
            <button type="button" onClick={handleCancel}
              className="px-3 py-1.5 font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-base-content transition-colors">
              {t('common.cancel')}
            </button>
            <button type="button" onClick={handleSubmit} disabled={!canPost}
              className="px-4 py-1.5 font-ui text-xs uppercase tracking-widest bg-primary text-primary-content hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
              {submitting ? t('composer.posting') : t('composer.post')}
            </button>
          </div>
        </div>

      </motion.div>
        </div>
      </div>

      {/* Portal host for dropdowns — must live inside FocusTrap so focus-trap
          v8's inert pass doesn't make them unclickable */}
      <div ref={popupHostRef} />

    </div>
    </FocusTrap>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
