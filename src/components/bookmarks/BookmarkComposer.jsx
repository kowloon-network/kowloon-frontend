// BookmarkComposer — modal for creating a bookmark or folder.
// Props:
//   initialValues: { href, title, image } — pre-filled (e.g. from PostToolbar)
//   onClose: () => void
//   onSaved: (bookmark) => void

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { X, FolderPlus, Folder } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import RichTextEditor from '../posts/LazyRichTextEditor'
import { toast } from '../../app/toast'

const VISIBILITY_OPTIONS = [
  { value: '@public', label: 'Public' },
  { value: '@server', label: 'Server only' },
]

// ── FolderPicker ─────────────────────────────────────────────────────────────

function FolderPicker({ folders, value, onChange }) {
  const { t } = useTranslation()
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full bg-base-200 border border-base-300 px-3 py-2 font-ui text-sm focus:outline-none focus:border-primary"
    >
      <option value="">— {t('bookmark.noFolder', { defaultValue: 'No folder' })} —</option>
      {folders.map((f) => (
        <optgroup key={f.id} label={f.title}>
          <option value={f.id}>{f.title}</option>
          {f.children?.map((sf) => (
            <option key={sf.id} value={sf.id}>&nbsp;&nbsp;{sf.title}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

// ── BookmarkComposer ──────────────────────────────────────────────────────────

export default function BookmarkComposer({ initialValues = {}, onClose, onSaved }) {
  const client = useClient()
  const { user } = useSelector((state) => state.auth)
  const { t } = useTranslation()

  const [href, setHref]             = useState(initialValues.href ?? '')
  const [title, setTitle]           = useState(initialValues.title ?? '')
  const [summary, setSummary]       = useState(initialValues.summary ?? '')
  const [image, setImage]           = useState(initialValues.image ?? null)
  const [notes, setNotes]           = useState('')
  const [tags, setTags]             = useState('')
  const [to, setTo]                 = useState('@public')
  const [parentFolder, setParentFolder] = useState(null)
  const [folders, setFolders]       = useState([])
  const [fetching, setFetching]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderSaving, setNewFolderSaving] = useState(false)

  // Idempotency key — reused across retries of the same bookmark so a network
  // blip can't create duplicates. Regenerated when user materially edits.
  const dedupeRef = useRef(null)
  // URL already auto-filled from, so a re-fetch (as the user keeps typing)
  // never re-injects title/summary/image the user has since edited or cleared.
  const autoFilledHrefRef = useRef(null)

  // Load the current user's folders for the picker
  useEffect(() => {
    if (!client || !user) return
    client.feeds.getUserBookmarks({ userId: user.id, type: 'Folder' })
      .then((res) => {
        const all = res?.orderedItems ?? res ?? []
        const roots = all.filter((f) => !f.parentFolder)
        setFolders(roots.map((f) => ({
          ...f,
          children: all.filter((c) => c.parentFolder === f.id),
        })))
      })
      .catch(() => {})
  }, [client, user])

  // Live link preview — debounced as the URL is typed/pasted, matching the
  // Link-type post composer's autofill. Fills title/summary/image once per
  // URL, only into fields that are still empty.
  useEffect(() => {
    if (!href.trim() || !client) return
    const url = href.trim()
    const timer = setTimeout(async () => {
      try { new URL(url) } catch { return }
      setFetching(true)
      try {
        const meta = await client.feeds.getLinkPreview({ url })
        if (meta && autoFilledHrefRef.current !== url) {
          autoFilledHrefRef.current = url
          if (meta.title && !title) setTitle(meta.title)
          if (meta.summary && !summary) setSummary(meta.summary)
          if (meta.image && !image) setImage(meta.image)
        }
      } catch {}
      finally { setFetching(false) }
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, client])

  const handleSave = async () => {
    if (!href || !title || saving) return
    setSaving(true)
    setError(null)
    const tagList = tags ? tags.split(',').map((s) => s.trim()).filter(Boolean) : []
    const signature = JSON.stringify({ href, title, summary, notes, tagList, to, parentFolder })
    if (!dedupeRef.current || dedupeRef.current.signature !== signature) {
      const key = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
      dedupeRef.current = { key, signature }
    }
    try {
      const res = await client.activities.createBookmark({
        href,
        title,
        summary: summary || undefined,
        image,
        body: notes || undefined,
        tags: tagList.length ? tagList : undefined,
        to,
        parentFolder: parentFolder ?? undefined,
        canReply: 'public',
        canReact: 'public',
        dedupeKey: dedupeRef.current.key,
      })
      dedupeRef.current = null
      onSaved?.(res?.created)
      onClose?.()
      toast.success(
        t('bookmark.savedToast', { defaultValue: 'Bookmark saved' }),
        user?.id
          ? { action: { label: t('bookmark.viewBookmarks', { defaultValue: 'View bookmarks' }), to: `/users/${encodeURIComponent(user.id)}/bookmarks` } }
          : undefined,
      )
    } catch (err) {
      setError(err.message)
      toast.error(t('bookmark.saveFailedToast', { defaultValue: 'Failed to save bookmark' }), { detail: err.message })
      setSaving(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || newFolderSaving) return
    setNewFolderSaving(true)
    setError(null)
    try {
      const res = await client.activities.createBookmark({
        type: 'Folder',
        title: newFolderName.trim(),
        to,
        parentFolder: parentFolder ?? undefined,
        canReply: 'public',
        canReact: 'public',
      })
      const created = res?.created
      if (created) {
        setFolders((prev) => {
          if (!created.parentFolder) {
            return [...prev, { ...created, children: [] }]
          }
          return prev.map((f) =>
            f.id === created.parentFolder
              ? { ...f, children: [...(f.children ?? []), created] }
              : f
          )
        })
        setParentFolder(created.id)
      }
      setShowNewFolder(false)
      setNewFolderName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setNewFolderSaving(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="bg-base-100 w-full max-w-lg flex flex-col border-2 border-primary shadow-2xl max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-base-300 bg-secondary shrink-0">
          <h2 className="font-display text-2xl text-secondary-content tracking-wide">
            {t('bookmark.add', { defaultValue: 'Add Bookmark' })}
          </h2>
          <button onClick={onClose} aria-label={t('common.close', { defaultValue: 'Close' })} className="text-secondary-content/70 hover:text-secondary-content transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-col gap-4 p-6 overflow-y-auto flex-1">

          {/* URL */}
          <div className="flex flex-col gap-1">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/60">
              {t('bookmark.url', { defaultValue: 'URL' })}
            </label>
            <input
              type="url"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              disabled={!!initialValues.href}
              placeholder="https://..."
              className={`w-full bg-base-200 border border-base-300 px-3 py-2 font-ui text-sm focus:outline-none focus:border-primary ${initialValues.href ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
          </div>

          {/* Featured image preview */}
          {image && (
            <div className="relative border border-base-300">
              <img src={image} alt="" className="w-full max-h-36 object-cover" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute top-1.5 right-1.5 px-2 py-1 bg-black/50 text-white font-ui text-xs uppercase tracking-widest hover:bg-black/70 transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          {/* Title */}
          <div className="flex flex-col gap-1">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/60">
              {t('bookmark.title', { defaultValue: 'Title' })}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={fetching ? t('bookmark.fetching', { defaultValue: 'Fetching...' }) : t('bookmark.titlePlaceholder', { defaultValue: 'Bookmark title' })}
              className="w-full bg-base-200 border border-base-300 px-3 py-2 font-ui text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-1">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/60">
              {t('bookmark.summary', { defaultValue: 'Summary' })}
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder={fetching ? t('bookmark.fetching', { defaultValue: 'Fetching...' }) : undefined}
              className="w-full bg-base-200 border border-base-300 px-3 py-2 font-ui text-sm focus:outline-none focus:border-primary resize-y"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/60">
              {t('bookmark.notes', { defaultValue: 'Notes' })}
            </label>
            <RichTextEditor
              content={notes}
              onChange={setNotes}
              editorClassName="min-h-[80px]"
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/60">
              {t('bookmark.tags', { defaultValue: 'Tags' })}{' '}
              <span className="text-base-content/40 normal-case tracking-normal">{t('bookmark.tagHint', { defaultValue: '(comma-separated)' })}</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="reading, design, reference"
              className="w-full bg-base-200 border border-base-300 px-3 py-2 font-ui text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Folder + Visibility */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="font-ui text-xs uppercase tracking-widest text-base-content/60">
                {t('bookmark.folder', { defaultValue: 'Folder' })}
              </label>
              <FolderPicker folders={folders} value={parentFolder} onChange={setParentFolder} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="font-ui text-xs uppercase tracking-widest text-base-content/60">
                {t('bookmark.visibility', { defaultValue: 'Visibility' })}
              </label>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-base-200 border border-base-300 px-3 py-2 font-ui text-sm focus:outline-none focus:border-primary"
              >
                {VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* New folder */}
          {showNewFolder ? (
            <div className="flex gap-2 items-end border-t border-base-300 pt-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-ui text-xs uppercase tracking-widest text-base-content/60">
                  {t('bookmark.newFolderName', { defaultValue: 'New folder name' })}
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  autoFocus
                  className="w-full bg-base-200 border border-base-300 px-3 py-2 font-ui text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || newFolderSaving}
                className="px-3 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-40"
              >
                {t('common.create', { defaultValue: 'Create' })}
              </button>
              <button
                onClick={() => { setShowNewFolder(false); setNewFolderName('') }}
                className="px-3 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:border-primary transition-colors"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-2 font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-primary transition-colors self-start"
            >
              <FolderPlus size={14} />
              {t('bookmark.newFolder', { defaultValue: 'New folder' })}
            </button>
          )}

          {error && (
            <p className="font-ui text-xs text-error">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t-2 border-base-300 shrink-0">
          <button
            onClick={onClose}
            className="font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-base-content transition-colors px-4 py-2"
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            onClick={handleSave}
            disabled={!href || !title || saving}
            className="px-6 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:bg-primary/80 transition-colors disabled:opacity-40"
          >
            {saving
              ? t('common.saving', { defaultValue: 'Saving...' })
              : t('bookmark.save', { defaultValue: 'Save Bookmark' })}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
