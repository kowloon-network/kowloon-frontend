// EditPostPage — edit an existing post. Owner only.
// Pre-populated with existing post data; same form as NewPostPage.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronDown, ChevronRight, Upload, Image as ImageIcon, Video, Music } from 'lucide-react'
import { useClient } from '../hooks/useClient'
import PostTypeSelector from '../components/posts/PostTypeSelector'
import RichTextEditor from '../components/posts/RichTextEditor'
import LocationField from '../components/posts/LocationField'
import CircleSelector from '../components/circles/CircleSelector'
import { useJoinedGroups } from '../hooks/useJoinedGroups'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'

const NOTE_MAX_WORDS = 500
const NOTE_MAX_CHARS = 5000
const countWords = (md) => md.trim().split(/\s+/).filter(Boolean).length

// ── Event date/time helpers (parity with NewPostPage / mobile) ────────────────

// A datetime-local string ("YYYY-MM-DDTHH:mm") has no zone. Sending it as-is let
// the server read it as UTC and the display shifted by the viewer's offset (#63)
// — convert to a real UTC ISO instant on save.
function toIsoInstant(local) {
  if (!local) return ''
  const d = new Date(local) // parsed in the browser's local zone
  return isNaN(d.getTime()) ? local : d.toISOString()
}

const pad = (n) => String(n).padStart(2, '0')

// Inverse of toIsoInstant: turn a stored ISO instant back into the local
// wall-clock "YYYY-MM-DDTHH:mm" the datetime-local input expects, so an event
// round-trips to the same displayed time (mobile edit.js splitDateTime).
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso).slice(0, 16)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function nextRoundHour() {
  const now = new Date()
  const h = now.getMinutes() > 0 ? (now.getHours() + 1) % 24 : now.getHours()
  return `${pad(h)}:00`
}
function addOneHourLocal(local) {
  if (!local) return ''
  const [datePart, timePart = '00:00'] = local.split('T')
  const [y, mo, da] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  const dt = new Date(y, (mo || 1) - 1, da || 1, (h || 0) + 1, mi || 0, 0, 0)
  if (isNaN(dt.getTime())) return local
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
// End-date follows start-date, blank/midnight start-time defaults to the next
// round hour, end-time = start + 1h (never before the start).
function applyStartChange(value, endValue, setStart, setEnd, hadStart) {
  if (!value) { setStart(''); return }
  let [datePart, timePart = ''] = value.split('T')
  if ((!timePart || timePart === '00:00') && !hadStart) timePart = nextRoundHour()
  const start = `${datePart}T${timePart || '00:00'}`
  setStart(start)
  if (!endValue) {
    setEnd(addOneHourLocal(start))
    return
  }
  const endTime = endValue.split('T')[1] || start.split('T')[1]
  let end = `${datePart}T${endTime}`
  if (end <= start) end = addOneHourLocal(start)
  setEnd(end)
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

// ── Shared form helpers ───────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">{label}</label>
      {children}
    </div>
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

export default function EditPostPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const client = useClient()
  const { t } = useTranslation()
  const { user, sessionChecked } = useSelector((state) => state.auth)
  const { items: myCircles } = useSelector((state) => state.myCircles)
  const joinedGroups = useJoinedGroups() // groups are addressable too (#67)
  const geocodingUrl = useSelector((state) => state.server.settings?.geocodingUrl)
  const maxUploadSize = useSelector((state) => state.server.settings?.maxUploadSize) // MB

  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [postType, setPostType]   = useState('Note')
  const [title, setTitle]         = useState('')
  const [content, setContent]     = useState('')
  const [href, setHref]           = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [location, setLocation]   = useState('')
  const [geo, setGeo]             = useState(null)
  const [tags, setTags]           = useState([])
  const [audience, setAudience]   = useState('@public')
  // Reply/react scope — loaded from the post; tracks the audience on change.
  const [canReply, setCanReply]   = useState('@public')
  const [canReact, setCanReact]   = useState('@public')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState(null)
  const [locating, setLocating]   = useState(false)

  // Media attachments — existing items carry { existing:true, fileId, url };
  // newly picked items carry { existing:false, file, previewUrl }. Both use
  // previewUrl as a stable key + <img> src.
  const [attachments, setAttachments] = useState([])
  const [uploadErrors, setUploadErrors] = useState({})
  // Featured (hero) image for Article/Event: null (none/removed),
  // { existing:true, fileId, url }, or { existing:false, file, previewUrl }.
  const [featuredImage, setFeaturedImage] = useState(null)

  const photoInputRef    = useRef(null)
  const videoInputRef    = useRef(null)
  const audioInputRef    = useRef(null)
  const artImageInputRef = useRef(null)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await client.feeds.getPost({ postId: id })
      const post = res?.item ?? res
      setPostType(post.type ?? 'Note')
      setTitle(post.title ?? '')
      setContent(post.source?.content ?? '')
      setHref(post.href ?? '')
      // Stored times are UTC instants; convert back to the local wall-clock the
      // datetime-local input shows so the round trip preserves the event time.
      setStartDate(toLocalInput(post.startTime))
      setEndDate(toLocalInput(post.endTime))
      setLocation(post.location?.name ?? '')
      setGeo(post.location?.lat != null ? { lat: post.location.lat, lon: post.location.lon } : null)
      setTags(Array.isArray(post.tags) ? post.tags : [])
      setAudience(post.to ?? '@public')
      // Reply/react default to the post audience when they were left to inherit.
      setCanReply(post.canReply ?? post.to ?? '@public')
      setCanReact(post.canReact ?? post.to ?? '@public')

      // Existing Media attachments — the detail route resolves each to
      // { fileId, url, name, mediaType, alt } so kept ones survive on save.
      if (post.type === 'Media' && Array.isArray(post.attachments)) {
        setAttachments(
          post.attachments
            .filter((a) => a?.fileId)
            .map((a) => ({
              existing: true,
              fileId: a.fileId,
              url: a.url,
              previewUrl: a.url,
              name: a.name ?? '',
              mediaType: a.mediaType ?? '',
            }))
        )
      }

      // Existing featured image (Article/Event). For the owner `image` is the
      // raw file ID; `featuredImage` is the resolved display URL.
      if ((post.type === 'Article' || post.type === 'Event') && post.image) {
        const isFileId = typeof post.image === 'string' && post.image.startsWith('file:')
        setFeaturedImage({
          existing: true,
          fileId: isFileId ? post.image : null,
          url:
            post.featuredImage ||
            (typeof post.image === 'string' && post.image.startsWith('http') ? post.image : null),
        })
      }
    } catch (err) {
      setLoadError(err.message || 'Failed to load post.')
    } finally {
      setLoading(false)
    }
  }, [client, id])

  useEffect(() => { load() }, [load])


  const wordCount   = postType === 'Note' ? countWords(content) : 0
  const charCount   = postType === 'Note' ? content.length : 0
  const atNoteLimit = postType === 'Note' && (wordCount >= NOTE_MAX_WORDS || charCount >= NOTE_MAX_CHARS)
  const noteWarn    = postType === 'Note' && (wordCount >= 450 || charCount >= 4500)

  const hasTitle = postType !== 'Note'
  const hasTags  = postType !== 'Note'
  const canSave  = !submitting && !atNoteLimit && (
    content.trim() ||
    postType === 'Media' ||
    postType === 'Link' ||
    postType === 'Article' ||
    (postType === 'Event' && startDate)
  )

  // Per-server upload ceiling (MB → bytes); Infinity until the profile loads.
  const maxUploadBytes = maxUploadSize > 0 ? maxUploadSize * 1024 * 1024 : Infinity
  const tooLargeMessage = (names) =>
    t('composer.fileTooLarge', {
      defaultValue: `${names} exceeds this server's ${maxUploadSize} MB upload limit.`,
      names,
      limit: maxUploadSize,
    })

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
          existing: false,
          file: f,
          name: f.name,
          mediaType: f.type,
          previewUrl: URL.createObjectURL(f),
        })),
      ])
    }
    e.target.value = ''
  }

  const removeAttachment = (i) => {
    setAttachments((prev) => {
      const att = prev[i]
      if (att && !att.existing && att.previewUrl) URL.revokeObjectURL(att.previewUrl)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  const handleArtImageFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxUploadBytes) {
      setError(tooLargeMessage(file.name))
      e.target.value = ''
      return
    }
    setFeaturedImage((prev) => {
      if (prev && !prev.existing && prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return { existing: false, file, previewUrl: URL.createObjectURL(file) }
    })
    e.target.value = ''
  }

  const removeFeaturedImage = () => {
    setFeaturedImage((prev) => {
      if (prev && !prev.existing && prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
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

  const handleSave = async () => {
    setSubmitting(true)
    setError(null)
    setUploadErrors({})
    try {
      const updates = {
        type: postType,
        title: title || undefined,
        content: content || undefined,
        href: href || undefined,
        // Convert local wall-clock → UTC instant so the event time doesn't
        // shift by the viewer's offset on save (#63).
        startTime: toIsoInstant(startDate) || undefined,
        endTime: toIsoInstant(endDate) || undefined,
        tags: tags.length ? tags : undefined,
        location: location ? { type: 'Place', name: location, ...(geo ?? {}) } : undefined,
        to: audience,
        canReply,
        canReact,
      }

      // Media attachments — upload any newly picked files, then send the kept +
      // new set. Existing kept files are re-sent by their fileId; alt text lives
      // on the File record and is preserved server-side.
      if (postType === 'Media') {
        const fresh = attachments.filter((a) => !a.existing)
        let uploaded = []
        if (fresh.length > 0) {
          const results = await Promise.allSettled(
            fresh.map((a) => client.files.upload({
              file: a.file, filename: a.file.name, contentType: a.file.type,
              title: a.name || a.file.name, to: audience,
            }))
          )
          const errors = {}
          results.forEach((r, i) => {
            if (r.status === 'rejected') errors[fresh[i].previewUrl] = r.reason?.message ?? 'Upload failed'
          })
          if (Object.keys(errors).length > 0) { setUploadErrors(errors); setSubmitting(false); return }
          uploaded = results
            .map((r, i) => ({ fileId: r.value?.file?.id, title: fresh[i].name || undefined }))
            .filter((x) => x.fileId)
        }
        const kept = attachments
          .filter((a) => a.existing && a.fileId)
          .map((a) => ({ fileId: a.fileId, title: a.name || undefined }))
        updates.attachments = [...kept, ...uploaded]
      }

      // Featured (hero) image — upload a newly picked one, keep the existing
      // file ID, or send "" to clear it.
      if (postType === 'Article' || postType === 'Event') {
        if (!featuredImage) {
          updates.featuredImage = ''
        } else if (featuredImage.existing) {
          updates.featuredImage = featuredImage.fileId || featuredImage.url || ''
        } else {
          const res = await client.files.upload({
            file: featuredImage.file, filename: featuredImage.file.name,
            contentType: featuredImage.file.type, to: audience,
          })
          updates.featuredImage = res?.file?.id || ''
        }
      }

      await client.activities.updatePost(id, updates)
      navigate(`/posts/${encodeURIComponent(id)}`)
    } catch (err) {
      setError(err.message || 'Failed to save.')
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner centered />
  if (loadError) return <ErrorState message={loadError} onRetry={load} />

  return (
    <div className="flex flex-col gap-0">

      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-base-300 bg-base-200 -mx-4 lg:-mx-8 px-4 lg:px-8 mb-6">
        <div className="flex items-center gap-3">
          <Link
            to={`/posts/${encodeURIComponent(id)}`}
            className="flex items-center gap-1.5 px-3 py-3 font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-base-content transition-colors"
          >
            <ArrowLeft size={13} />
          </Link>
          <PostTypeSelector value={postType} onChange={setPostType} />
        </div>
        <span className="font-ui text-xs uppercase tracking-widest text-base-content/40 pr-3">
          {t('post.editing', { defaultValue: 'Editing' })}
        </span>
      </div>

      <div className="flex flex-col gap-6">

        {/* Link URL */}
        {postType === 'Link' && (
          <Field label={t('composer.linkUrlLabel', { defaultValue: 'URL' })}>
            <input
              type="url"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://…"
              className="w-full px-4 py-3 bg-base-100 border-2 border-base-300 focus:border-primary outline-none font-display text-3xl tracking-wide text-base-content placeholder:text-base-content/30 transition-colors"
            />
          </Field>
        )}

        {/* Title */}
        {hasTitle && (
          <Field label={t('composer.titleLabel', { defaultValue: 'Title' })}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('composer.title', { defaultValue: 'Title' })}
              className="w-full px-4 py-3 bg-base-100 border-2 border-base-300 focus:border-primary outline-none font-display text-3xl tracking-wide text-base-content placeholder:text-base-content/30 transition-colors"
            />
          </Field>
        )}

        {/* Article / Event featured (hero) image */}
        {(postType === 'Article' || postType === 'Event') && (
          <Field label={t('composer.featuredImage', { defaultValue: 'Featured image (optional)' })}>
            {featuredImage ? (
              <div className="relative">
                <img src={featuredImage.url || featuredImage.previewUrl} alt="" className="w-full max-h-48 object-cover" />
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => artImageInputRef.current?.click()}
                    className="px-2 py-1 bg-black/50 text-white font-ui text-xs uppercase tracking-widest hover:bg-black/70 transition-colors"
                  >
                    {t('composer.replaceImage', { defaultValue: 'Replace' })}
                  </button>
                  <button
                    type="button"
                    onClick={removeFeaturedImage}
                    aria-label={t('composer.removeFeaturedImage', { defaultValue: 'Remove image' })}
                    className="px-2 py-1 bg-black/50 text-white font-ui text-xs uppercase tracking-widest hover:bg-black/70 transition-colors"
                  >✕</button>
                </div>
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

        {/* Media attachments — add/remove existing and new files */}
        {postType === 'Media' && (
          <Field label={t('composer.media', { defaultValue: 'Media' })}>
            {attachments.length > 0 && (
              <div className="border-2 border-base-300 mb-2">
                {attachments.map((att, i) => {
                  const isImg = (att.mediaType || '').startsWith('image/')
                  return (
                    <div key={att.previewUrl || att.fileId || i}
                      className={`flex items-center gap-3 py-3 px-3 border-b border-base-300 last:border-b-0 ${uploadErrors[att.previewUrl] ? 'bg-error/5' : ''}`}>
                      {isImg
                        ? <img src={att.previewUrl || att.url} alt="" className="w-16 h-16 object-cover shrink-0 bg-base-200" />
                        : <div className="w-16 h-16 shrink-0 bg-base-200 flex items-center justify-center font-ui text-[10px] uppercase tracking-widest text-base-content/50 text-center px-1">
                            {(att.mediaType || '').split('/')[0] || t('composer.file', { defaultValue: 'File' })}
                          </div>}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-ui text-xs uppercase tracking-widest text-base-content truncate">{att.name || att.mediaType || '—'}</span>
                        {uploadErrors[att.previewUrl] && (
                          <span className="font-ui text-xs uppercase tracking-widest text-error">{uploadErrors[att.previewUrl]}</span>
                        )}
                      </div>
                      <button type="button" onClick={() => removeAttachment(i)}
                        className="shrink-0 font-ui text-xs uppercase tracking-widest text-base-content/30 hover:text-error transition-colors">
                        {t('composer.attachmentRemove', { defaultValue: 'Remove' })}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Three single-type-accept buttons, not two — issue #60.
                Chromium's fast single-tap Android Photo Picker only kicks in
                when `accept` resolves to exactly one clean type; combining
                image/*+video/* still fell back to the full "Choose an
                action" chooser (Camera / Camera Camcorder / Files) —
                confirmed live on a real Android phone, not assumed. Each
                button gets its own single-type input; handleFileAdd only
                ever reads e.target.files, so all three reuse it unchanged. */}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="flex-1 min-w-[7rem] flex items-center justify-center gap-2 px-4 py-3 border-2 border-base-300 border-dashed font-ui text-xs uppercase tracking-widest text-base-content/40 hover:border-primary hover:text-primary transition-colors">
                <ImageIcon size={13} />
                {t('composer.addPhoto', { defaultValue: 'Photo' })}
              </button>
              <button type="button" onClick={() => videoInputRef.current?.click()}
                className="flex-1 min-w-[7rem] flex items-center justify-center gap-2 px-4 py-3 border-2 border-base-300 border-dashed font-ui text-xs uppercase tracking-widest text-base-content/40 hover:border-primary hover:text-primary transition-colors">
                <Video size={13} />
                {t('composer.addVideo', { defaultValue: 'Video' })}
              </button>
              <button type="button" onClick={() => audioInputRef.current?.click()}
                className="flex-1 min-w-[7rem] flex items-center justify-center gap-2 px-4 py-3 border-2 border-base-300 border-dashed font-ui text-xs uppercase tracking-widest text-base-content/40 hover:border-primary hover:text-primary transition-colors">
                <Music size={13} />
                {t('composer.addAudio', { defaultValue: 'Audio' })}
              </button>
            </div>
            {attachments.length > 0 && (
              <p className="font-ui text-[10px] uppercase tracking-widest text-base-content/30 mt-1">
                {t('composer.addMoreHint', { defaultValue: 'Tap any button above to add more' })}
              </p>
            )}
            <input ref={photoInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileAdd} />
            <input ref={videoInputRef} type="file" multiple accept="video/*" className="hidden" onChange={handleFileAdd} />
            <input ref={audioInputRef} type="file" multiple accept="audio/*" className="hidden" onChange={handleFileAdd} />
          </Field>
        )}

        {/* Event datetimes */}
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
        <Field label={t('composer.body', { defaultValue: 'Body' })}>
          <RichTextEditor
            content={content}
            onChange={setContent}
            maxWords={postType === 'Note' ? NOTE_MAX_WORDS : undefined}
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

        {/* Advanced — who can reply / react. Seeded from the post's audience. */}
        <ReplyReactScope
          audience={audience}
          canReply={canReply}
          canReact={canReact}
          onChangeReply={setCanReply}
          onChangeReact={setCanReact}
          circles={myCircles}
          groups={joinedGroups}
        />

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t-2 border-base-300">
          <CircleSelector
            circles={myCircles}
            groups={joinedGroups}
            value={audience}
            onChange={(v) => { setAudience(v); setCanReply(v); setCanReact(v) }}
            showAudience
            direction="up"
          />

          <div className="flex items-center gap-3">
            {error && (
              <span role="alert" className="font-ui text-xs uppercase tracking-widest text-error">
                {error}
              </span>
            )}
            <Link
              to={`/posts/${encodeURIComponent(id)}`}
              className="px-4 py-2 font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-base-content transition-colors"
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-6 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting
                ? t('common.saving', { defaultValue: 'Saving…' })
                : t('common.save', { defaultValue: 'Save' })
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
