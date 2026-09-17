// NewPostPage — full-page post editor. Authenticated users only.
// Type selector at top; form fields adapt to post type; CircleSelector for audience.

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { X, Upload, Music, GripVertical, ChevronDown, ChevronRight } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useClient } from '../hooks/useClient'
import PostTypeSelector from '../components/posts/PostTypeSelector'
import RichTextEditor from '../components/posts/RichTextEditor'
import LocationField from '../components/posts/LocationField'
import CircleSelector from '../components/circles/CircleSelector'
import { useJoinedGroups } from '../hooks/useJoinedGroups'

const NOTE_MAX_WORDS = 500
const NOTE_MAX_CHARS = 5000
const countWords = (md) => md.trim().split(/\s+/).filter(Boolean).length

// Map a stored prefs/audience value ('@public', '@<domain>', a circle/group id)
// to the ids the web CircleSelector uses ('public' | 'server' | id).
function prefAudienceToWeb(val) {
  if (!val || val === '@public' || val === 'public') return 'public'
  if (val === 'server' || val === '@server') return 'server'
  if (/^@[^@]+$/.test(val)) return 'server' // bare @domain = this community
  return val // circle / group id
}

// ── Reply/React scope ("Advanced") ───────────────────────────────────────────

function ReplyReactScope({ audience, canReply, canReact, onChangeReply, onChangeReact, circles, groups }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const customized = canReply !== audience || canReact !== audience
  return (
    <div className="border-t-2 border-base-300 pt-4">
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
            <CircleSelector circles={circles} groups={groups} value={canReply} onChange={onChangeReply} showAudience />
          </div>
          <div className="flex items-center gap-3">
            <span className="font-ui text-xs uppercase tracking-widest text-base-content/50 w-28 shrink-0">
              {t('composer.whoCanReact', { defaultValue: 'Who can react' })}
            </span>
            <CircleSelector circles={circles} groups={groups} value={canReact} onChange={onChangeReact} showAudience />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small local form helpers ──────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text', inputRef, onBlur, large = false }) {
  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`w-full px-4 py-3 bg-base-100 border-2 border-base-300 focus:border-primary outline-none transition-colors ${
        large ? 'font-display text-3xl tracking-wide' : 'font-ui text-sm tracking-wide'
      } text-base-content placeholder:text-base-content/30`}
    />
  )
}

function TagsInput({ tags, onChange }) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')

  const commit = () => {
    const tag = input.trim().replace(/^#+/, '').toLowerCase()
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setInput('')
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-2 border-base-300 bg-base-100 min-h-11">
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
          if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={commit}
        placeholder={tags.length ? '' : t('composer.tagsPlaceholder', { defaultValue: 'Add tags…' })}
        className="flex-1 min-w-24 bg-transparent font-ui text-xs uppercase tracking-widest text-base-content placeholder:text-base-content/30 outline-none"
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Sortable attachment row ───────────────────────────────────────────────────

function SortableMediaRow({ att, index, onUpdate, onRemove, isFeatured, onSetFeatured, uploadError }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: att.previewUrl })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const isImg = att.file.type.startsWith('image/')

  return (
    <div ref={setNodeRef} style={style} className={`flex items-start gap-3 py-3 border-b border-base-300 ${uploadError ? 'bg-error/5' : ''}`}>
      <button type="button" {...attributes} {...listeners}
        className="shrink-0 self-center text-base-content/25 hover:text-base-content/60 cursor-grab active:cursor-grabbing touch-none p-1"
        aria-label={t('composer.dragToReorder')}>
        <GripVertical size={14} />
      </button>
      {isImg && <img src={att.previewUrl} alt="" className="w-16 h-16 object-cover shrink-0 bg-base-200" />}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <input type="text" value={att.title} onChange={(e) => onUpdate(index, 'title', e.target.value)}
          placeholder={t('composer.attachmentTitle', { defaultValue: 'Title' })}
          className="bg-transparent font-ui text-xs uppercase tracking-widest text-base-content placeholder:text-base-content/30 outline-none border-b border-base-300 pb-0.5" />
        <input type="text" value={att.alt} onChange={(e) => onUpdate(index, 'alt', e.target.value)}
          placeholder={t('composer.attachmentAlt', { defaultValue: 'Alt text' })}
          className="bg-transparent font-reading text-xs text-base-content/70 placeholder:text-base-content/30 outline-none" />
        {uploadError && <span className="font-ui text-xs uppercase tracking-widest text-error">{uploadError}</span>}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 text-right">
        <button type="button" onClick={() => onRemove(index)}
          className="font-ui text-xs uppercase tracking-widest text-base-content/30 hover:text-error transition-colors">
          {t('composer.attachmentRemove', { defaultValue: 'Remove' })}
        </button>
        <button type="button" onClick={() => onSetFeatured(index)}
          className={`font-ui text-xs uppercase tracking-widest transition-colors ${isFeatured ? 'text-primary' : 'text-base-content/30 hover:text-base-content'}`}>
          {isFeatured ? t('composer.attachmentFeatured', { defaultValue: 'Featured' }) : t('composer.attachmentSetFeatured', { defaultValue: 'Set featured' })}
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// A <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm") has no zone, so
// sending it as-is let the server read it as UTC and the display shifted it by
// the viewer's offset (#63). Convert to a real UTC ISO instant.
function toIsoInstant(local) {
  if (!local) return ''
  const d = new Date(local) // datetime-local parses in the browser's local zone
  return isNaN(d.getTime()) ? local : d.toISOString()
}

// ── Event date/time auto-fill (parity with PostComposer / mobile compose.js) ──
// See project_event_datetime_logic memory: end-date follows start-date, a blank
// start-time defaults to the next round hour, and end-time = start + 1h.
const pad = (n) => String(n).padStart(2, '0')
function nextRoundHour() {
  const now = new Date()
  const h = now.getMinutes() > 0 ? (now.getHours() + 1) % 24 : now.getHours()
  return `${pad(h)}:00`
}
// Add one hour to a "YYYY-MM-DDTHH:mm" local string, rolling the date over.
function addOneHourLocal(local) {
  if (!local) return ''
  const [datePart, timePart = '00:00'] = local.split('T')
  const [y, mo, da] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  const dt = new Date(y, (mo || 1) - 1, da || 1, (h || 0) + 1, mi || 0, 0, 0)
  if (isNaN(dt.getTime())) return local
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
// Shared handler: when the start datetime changes, default a bare/midnight time
// to the next round hour and keep the end aligned (same date, +1h, never before
// the start). Callers pass the current end value and the two setters.
function applyStartChange(value, endValue, setStart, setEnd, hadStart) {
  if (!value) { setStart(''); return }
  let [datePart, timePart = ''] = value.split('T')
  // Fresh date pick with a bare/midnight time → sensible next round hour.
  if ((!timePart || timePart === '00:00') && !hadStart) timePart = nextRoundHour()
  const start = `${datePart}T${timePart || '00:00'}`
  setStart(start)
  if (!endValue) {
    setEnd(addOneHourLocal(start))
    return
  }
  // End-date follows the start's date; keep the user's end time unless that
  // would put the end at or before the start, in which case snap to start + 1h.
  const endTime = endValue.split('T')[1] || start.split('T')[1]
  let end = `${datePart}T${endTime}`
  if (end <= start) end = addOneHourLocal(start)
  setEnd(end)
}

export default function NewPostPage() {
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const { items: myCircles } = useSelector((state) => state.myCircles)
  const joinedGroups = useJoinedGroups() // groups are addressable too (#67)
  const geocodingUrl = useSelector((state) => state.server.settings?.geocodingUrl)
  const maxUploadSize = useSelector((state) => state.server.settings?.maxUploadSize) // MB
  const client = useClient()
  const { t } = useTranslation()

  // Composer opens on the user's composing defaults (prefs.*).
  const [postType, setPostType]   = useState(user?.prefs?.defaultPostType ?? 'Note')
  const [title, setTitle]         = useState('')
  const [content, setContent]     = useState('')
  const [href, setHref]           = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [location, setLocation]   = useState('')
  const [geo, setGeo]             = useState(null)
  const [tags, setTags]           = useState([])
  const [audience, setAudience]   = useState(prefAudienceToWeb(user?.prefs?.defaultTo))
  // Reply/react scope — seeded from the composing prefs; tracks the audience
  // until narrowed by hand (reset when the audience changes).
  const [canReply, setCanReply]   = useState(prefAudienceToWeb(user?.prefs?.defaultcanReply))
  const [canReact, setCanReact]   = useState(prefAudienceToWeb(user?.prefs?.defaultcanReact))
  const [linkPreview, setLinkPreview] = useState(null) // { title, summary, image } from /preview
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState(null)
  const [fetchingMeta, setFetchingMeta] = useState(false)
  const [locating, setLocating]   = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  // Media attachments
  const [attachments, setAttachments] = useState([])   // [{ file, title, alt, previewUrl }]
  const [featuredIdx, setFeaturedIdx] = useState(0)
  const [uploadErrors, setUploadErrors] = useState({})

  // Article + Link featured image
  const [featuredImage, setFeaturedImage]         = useState(null) // URL (from og:fetch) or null
  const [artFeaturedFile, setArtFeaturedFile]     = useState(null)
  const [artFeaturedPreview, setArtFeaturedPreview] = useState(null)

  const hrefRef          = useRef(null)
  const mediaInputRef    = useRef(null) // photo/video
  const audioInputRef    = useRef(null)
  const artImageInputRef = useRef(null)

  // Idempotency key for retry-safe submission — reused across retries of the
  // same content so the server short-circuits duplicates on a slow network +
  // double-tap. Regenerated when any user-visible field changes. Mirrors the
  // PostComposer / mobile compose.js pattern.
  const dedupeRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const wordCount   = postType === 'Note' ? countWords(content) : 0
  const charCount   = postType === 'Note' ? content.length : 0
  const atNoteLimit = postType === 'Note' && (wordCount >= NOTE_MAX_WORDS || charCount >= NOTE_MAX_CHARS)
  const noteWarn    = postType === 'Note' && (wordCount >= 450 || charCount >= 4500)

  const hasTitle = postType !== 'Note'
  const hasTags  = postType !== 'Note'
  const canPost  = !submitting && !atNoteLimit &&
    (content.trim() || (postType === 'Event' && startDate) || (postType === 'Media' && attachments.length > 0))

  const handleTypeChange = (newType) => {
    if (newType === 'Note' && postType !== 'Note') {
      const words = content.trim().split(/\s+/).filter(Boolean)
      if (words.length > NOTE_MAX_WORDS) {
        setContent(words.slice(0, NOTE_MAX_WORDS).join(' '))
        setEditorKey((k) => k + 1)
      }
    }
    setPostType(newType)
  }

  // Fetch link metadata: preview card + blank-title autofill + OG image + drop
  // the source summary into an empty body as a blockquote (matches mobile).
  const fetchLinkMeta = async (url) => {
    if (!url || !client) return
    try { new URL(url) } catch { return }
    setFetchingMeta(true)
    try {
      const meta = await client.feeds.getLinkPreview({ url })
      setLinkPreview(meta || null)
      if (meta?.title && !title) setTitle(meta.title)
      if (meta?.image && !featuredImage) setFeaturedImage(meta.image)
      if (meta?.summary && !content.trim()) {
        const quoted = meta.summary.trim().split(/\n+/).map((l) => `> ${l}`).join('\n')
        setContent(`${quoted}\n\n`)
        setEditorKey((k) => k + 1) // RichTextEditor only reads `content` on mount
      }
    } catch {}
    finally { setFetchingMeta(false) }
  }

  // Live link preview — debounced as the URL is typed.
  useEffect(() => {
    if (postType !== 'Link' || !href.trim()) {
      setLinkPreview(null)
      return
    }
    const timer = setTimeout(() => fetchLinkMeta(href.trim()), 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, postType, client])

  // Per-server upload ceiling (MB → bytes); Infinity until the profile loads.
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
        ...ok.map((f) => ({ file: f, title: f.name.replace(/\.[^.]+$/, ''), alt: '', previewUrl: URL.createObjectURL(f) })),
      ])
    }
    e.target.value = ''
  }

  const updateAttachment = (i, field, value) =>
    setAttachments((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))

  const removeAttachment = (i) => {
    setAttachments((prev) => { URL.revokeObjectURL(prev[i].previewUrl); return prev.filter((_, idx) => idx !== i) })
    setFeaturedIdx((prev) => (prev >= i && prev > 0 ? prev - 1 : prev))
  }

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setAttachments((prev) => {
      const oldIdx = prev.findIndex((a) => a.previewUrl === active.id)
      const newIdx = prev.findIndex((a) => a.previewUrl === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
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
        const reverseUrl = `${(geocodingUrl || 'https://nominatim.openstreetmap.org').replace(/\/$/, '')}/reverse?format=json&lat=${lat}&lon=${lon}`
        try {
          const res = await fetch(reverseUrl, { headers: { 'Accept-Language': 'en', 'User-Agent': 'kowloon-frontend/1.0' } })
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

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    setUploadErrors({})
    // Reuse the same dedupeKey across retries of the same content; changing any
    // user-visible field is a "different post" and gets a fresh key.
    const signature = JSON.stringify({
      postType, content, title, href, tags, location, audience,
      startDate, endDate, canReply, canReact,
      attachmentNames: attachments.map((a) => a.file.name),
    })
    if (!dedupeRef.current || dedupeRef.current.signature !== signature) {
      const key = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
      dedupeRef.current = { key, signature }
    }
    try {
      let uploadedAttachments
      let uploadedFeaturedImage = featuredImage || undefined

      // Upload Article/Event featured (hero) image if a file was selected
      if ((postType === 'Article' || postType === 'Event') && artFeaturedFile) {
        const res = await client.files.upload({
          file: artFeaturedFile, filename: artFeaturedFile.name, contentType: artFeaturedFile.type, to: audience,
        })
        if (res?.file?.id) uploadedFeaturedImage = res.file.id
      }

      // Upload Media attachments
      if (postType === 'Media' && attachments.length > 0) {
        const results = await Promise.allSettled(
          attachments.map((att) => client.files.upload({
            file: att.file, filename: att.file.name, contentType: att.file.type,
            title: att.title || att.file.name, summary: att.alt || undefined, to: audience,
          }))
        )
        const errors = {}
        results.forEach((r, i) => { if (r.status === 'rejected') errors[attachments[i].previewUrl] = r.reason?.message ?? 'Upload failed' })
        if (Object.keys(errors).length > 0) { setUploadErrors(errors); setSubmitting(false); return }
        uploadedAttachments = results.map((r, i) => ({
          fileId: r.value.file.id, title: attachments[i].title || undefined, alt: attachments[i].alt || undefined,
        }))
        if (results[featuredIdx]?.value?.file?.id) uploadedFeaturedImage = results[featuredIdx].value.file.id
      }

      const res = await client.activities.createPost({
        type: postType,
        title: title || undefined,
        content: content || undefined,
        href: href || undefined,
        startTime: toIsoInstant(startDate) || undefined,
        endTime: toIsoInstant(endDate) || undefined,
        tags: tags.length ? tags : undefined,
        location: location ? { type: 'Place', name: location, ...(geo ?? {}) } : undefined,
        to: audience,
        canReply,
        canReact,
        attachments: uploadedAttachments,
        featuredImage: uploadedFeaturedImage,
        dedupeKey: dedupeRef.current.key,
      })
      const postId = res?.result?.id ?? res?.createdId
      navigate(postId ? `/posts/${encodeURIComponent(postId)}` : '/')
    } catch (err) {
      setError(err.message || 'Failed to post.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-0">

      {/* Type selector bar */}
      <div className="flex items-center justify-between border-b-2 border-base-300 bg-base-200 -mx-4 lg:-mx-8 px-4 lg:px-8 mb-6">
        <PostTypeSelector value={postType} onChange={handleTypeChange} />
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('common.cancel', { defaultValue: 'Cancel' })}
          className="px-3 py-2 font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-base-content transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-6">

        {/* Link URL */}
        {postType === 'Link' && (
          <Field label={t('composer.linkUrlLabel', { defaultValue: 'URL' })}>
            <div className={`relative ${fetchingMeta ? 'opacity-50' : ''}`}>
              <TextInput
                inputRef={hrefRef}
                type="url"
                value={href}
                onChange={setHref}
                onBlur={() => fetchLinkMeta(href)}
                placeholder={t('composer.linkUrl', { defaultValue: 'https://…' })}
                large
              />
              {fetchingMeta && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-ui text-xs uppercase tracking-widest text-base-content/40">
                  {t('common.loading', { defaultValue: 'Loading…' })}
                </span>
              )}
            </div>
          </Field>
        )}

        {/* Title */}
        {hasTitle && (
          <Field label={t('composer.titleLabel', { defaultValue: 'Title' })}>
            <TextInput value={title} onChange={setTitle} placeholder={t('composer.title', { defaultValue: 'Title' })} large />
          </Field>
        )}

        {/* Article / Event featured (hero) image */}
        {(postType === 'Article' || postType === 'Event') && (
          <Field label={t('composer.featuredImage', { defaultValue: 'Featured image (optional)' })}>
            {artFeaturedPreview ? (
              <div className="relative">
                <img src={artFeaturedPreview} alt="" className="w-full max-h-48 object-cover" />
                <button
                  type="button"
                  onClick={() => { URL.revokeObjectURL(artFeaturedPreview); setArtFeaturedPreview(null); setArtFeaturedFile(null) }}
                  aria-label={t('composer.removeFeaturedImage', { defaultValue: 'Remove image' })}
                  className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white font-ui text-xs uppercase tracking-widest hover:bg-black/70 transition-colors"
                >✕</button>
              </div>
            ) : (
              <button type="button" onClick={() => artImageInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 border-2 border-base-300 border-dashed font-ui text-xs uppercase tracking-widest text-base-content/40 hover:border-primary hover:text-primary transition-colors w-full">
                <Upload size={13} />
                {t('composer.addFeaturedImage', { defaultValue: 'Add featured image' })}
              </button>
            )}
            <input ref={artImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleArtImageFile} />
          </Field>
        )}

        {/* Link OG preview card — thumbnail + title + summary, live-fetched from
            /preview as the URL is typed. The featured image is removable. */}
        {postType === 'Link' && (fetchingMeta || linkPreview || featuredImage) && (
          <div className="flex gap-3 items-start p-3 border-2 border-base-300 bg-base-200">
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

        {/* Media attachments */}
        {postType === 'Media' && (
          <Field label={t('composer.media', { defaultValue: 'Media' })}>
            {attachments.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={attachments.map((a) => a.previewUrl)} strategy={verticalListSortingStrategy}>
                  <div className="border-2 border-base-300 mb-2">
                    {attachments.map((att, i) => (
                      <SortableMediaRow key={att.previewUrl} att={att} index={i}
                        onUpdate={updateAttachment} onRemove={removeAttachment}
                        isFeatured={i === featuredIdx} onSetFeatured={setFeaturedIdx}
                        uploadError={uploadErrors[att.previewUrl]} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            {/* Two accept-scoped buttons rather than one combined one — see
                PostComposer.jsx's identical split for why (issue #60: a
                broad multi-type accept with no capture hint is what produces
                Android's ambiguous "Camera / Camera Files / Files" chooser).
                handleFileAdd only ever reads e.target.files, so both inputs
                reuse it unchanged. */}
            <div className="flex gap-2">
              <button type="button" onClick={() => mediaInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-base-300 border-dashed font-ui text-xs uppercase tracking-widest text-base-content/40 hover:border-primary hover:text-primary transition-colors">
                <Upload size={13} />
                {attachments.length > 0
                  ? t('composer.addMore', { defaultValue: 'Add more files' })
                  : t('composer.addPhotoVideo', { defaultValue: 'Photo or Video' })
                }
              </button>
              <button type="button" onClick={() => audioInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-base-300 border-dashed font-ui text-xs uppercase tracking-widest text-base-content/40 hover:border-primary hover:text-primary transition-colors">
                <Music size={13} />
                {t('composer.addAudio', { defaultValue: 'Audio' })}
              </button>
            </div>
            <input ref={mediaInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileAdd} />
            <input ref={audioInputRef} type="file" multiple accept="audio/*" className="hidden" onChange={handleFileAdd} />
          </Field>
        )}

        {/* Event date/time */}
        {postType === 'Event' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('composer.startDateLabel', { defaultValue: 'Start' })}>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => applyStartChange(e.target.value, endDate, setStartDate, setEndDate, !!startDate)}
                className="w-full px-4 py-3 bg-base-100 border-2 border-base-300 focus:border-primary outline-none font-ui text-sm text-base-content transition-colors"
              />
            </Field>
            <Field label={t('composer.endDateLabel', { defaultValue: 'End (optional)' })}>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-base-100 border-2 border-base-300 focus:border-primary outline-none font-ui text-sm text-base-content transition-colors"
              />
            </Field>
          </div>
        )}

        {/* Body */}
        <Field label={t('composer.body', { defaultValue: postType === 'Note' ? 'Note' : 'Body' })}>
          <RichTextEditor
            key={editorKey}
            content={content}
            onChange={setContent}
            maxWords={postType === 'Note' ? NOTE_MAX_WORDS : undefined}
            // Only autofocus the body for Notes. For other types the body sits
            // below the title + type fields (URL/image/date), and focusing it
            // scrolls those out of view. See kowloon-mobile compose.js.
            autoFocus={postType === 'Note'}
            editorClassName="min-h-[40vh]"
          />
          {postType === 'Note' && (
            <div className="flex justify-end mt-1">
              <span className={`font-ui text-xs uppercase tracking-widest tabular-nums ${
                atNoteLimit ? 'text-error' : noteWarn ? 'text-warning' : 'text-base-content/30'
              }`}>
                {wordCount} / {NOTE_MAX_WORDS} {t('composer.words', { defaultValue: 'words' })}
              </span>
            </div>
          )}
        </Field>

        {/* Tags */}
        {hasTags && (
          <Field label={t('composer.tagsLabel', { defaultValue: 'Tags' })}>
            <TagsInput tags={tags} onChange={setTags} />
          </Field>
        )}

        {/* Location */}
        <Field label={t('composer.locationLabel', { defaultValue: 'Location (optional)' })}>
          <LocationField
            value={location}
            onChange={setLocation}
            geo={geo}
            onGeoSelect={setGeo}
            locating={locating}
            onGeolocate={handleGeolocate}
            geocodingUrl={geocodingUrl}
            variant="page"
          />
        </Field>

        {/* Advanced — who can reply / react. Seeded from the audience below. */}
        <ReplyReactScope
          audience={audience}
          canReply={canReply}
          canReact={canReact}
          onChangeReply={setCanReply}
          onChangeReact={setCanReact}
          circles={myCircles}
          groups={joinedGroups}
        />

        {/* Footer: audience + actions */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t-2 border-base-300">
          <CircleSelector
            circles={myCircles}
            groups={joinedGroups}
            value={audience}
            onChange={(v) => { setAudience(v); setCanReply(v); setCanReact(v) }}
            showAudience
            allowCreate
            direction="up"
          />

          <div className="flex items-center gap-3">
            {error && (
              <span role="alert" className="font-ui text-xs uppercase tracking-widest text-error">
                {error}
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-base-content transition-colors"
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canPost}
              className="px-6 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting
                ? t('composer.posting', { defaultValue: 'Posting…' })
                : t('composer.post', { defaultValue: 'Post' })
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
