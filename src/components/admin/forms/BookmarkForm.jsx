// BookmarkForm -- create or edit a server Bookmark (or Folder). Used by
// AdminBookmarkEditPage for both /admin/bookmarks/new and /admin/bookmarks/:id/edit.

import { useState, useEffect, useRef } from 'react'
import { useClient } from '../../../hooks/useClient'

// Mirrors the server's getServerActorId() fallback (`@${domain}`).
function serverActorId(client) {
  try {
    return `@${new URL(client.http.baseUrl).host}`
  } catch {
    return null
  }
}

// Explicit @<domain> token, NOT the literal '@server' AdminGroupsPage/
// AdminPagesPage use -- canSeeObject() (single-item fetch, folder-chain
// checks) has no legacy-token handling for '@server', only
// buildVisibilityQuery() (list endpoints) does, so '@server' content 404s
// on direct fetch. Bookmarks/folders are fetched by id and their folder
// chain is checked, so this distinction actually matters here.
function visibilityOptions(client) {
  const domain = serverActorId(client)
  return [
    { value: '@public', label: 'Public' },
    { value: domain || '@server', label: 'Server only' },
  ]
}

export default function BookmarkForm({ initial, folders = [], onSave, onCancel }) {
  const client = useClient()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [type, setType] = useState(initial?.type ?? 'Bookmark')
  const [href, setHref] = useState(initial?.href ?? '')
  const [parentFolder, setParentFolder] = useState(initial?.parentFolder ?? '')
  const [to, setTo] = useState(initial?.to || '@public')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fetchingPreview, setFetchingPreview] = useState(false)
  // URL already auto-filled from, so a re-fetch (as the user keeps typing)
  // never re-injects title/summary the user has since edited or cleared.
  const autoFilledHrefRef = useRef(null)

  const VISIBILITY_OPTIONS = visibilityOptions(client)

  // Live link preview -- debounced as the URL is typed/pasted, matching
  // PostComposer's Link-type autofill. Fills title/summary once per URL,
  // only into fields that are still empty.
  useEffect(() => {
    if (type !== 'Bookmark' || !href.trim() || !client) return
    const url = href.trim()
    const timer = setTimeout(async () => {
      try { new URL(url) } catch { return }
      setFetchingPreview(true)
      try {
        const meta = await client.feeds.getLinkPreview({ url })
        if (meta && autoFilledHrefRef.current !== url) {
          autoFilledHrefRef.current = url
          if (meta.title && !title) setTitle(meta.title)
          if (meta.summary && !summary) setSummary(meta.summary)
        }
      } catch {}
      finally { setFetchingPreview(false) }
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, type, client])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const opts = {
        title,
        summary: summary || undefined,
        type,
        href: type === 'Bookmark' ? href : undefined,
        parentFolder: type === 'Bookmark' && parentFolder ? parentFolder : undefined,
        to,
      }

      let res
      if (initial?.id) {
        res = await client.admin.updateBookmark({ bookmarkId: initial.id, updates: opts })
        onSave(res.bookmark)
      } else {
        res = await client.admin.createBookmark(opts)
        onSave(res.bookmark)
      }
    } catch (err) {
      setError(
        err?.status === 403 || err?.statusCode === 403
          ? 'Only bookmarks this server created can be edited here.'
          : err?.message || 'Failed to save bookmark'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {error && <p className="font-ui text-xs text-error">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {type === 'Bookmark' && (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">
              URL * {fetchingPreview && <span className="normal-case tracking-normal text-base-content/40">fetching preview...</span>}
            </label>
            <input value={href} onChange={(e) => setHref(e.target.value)} required
              placeholder="https://..."
              className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={!!initial?.id}
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none disabled:opacity-50">
            <option value="Bookmark">Bookmark (link)</option>
            <option value="Folder">Folder</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Visibility</label>
          <select value={to} onChange={(e) => setTo(e.target.value)}
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none">
            {VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>

        {type === 'Bookmark' && (
          <>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Summary</label>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2}
                className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none resize-y" />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Folder</label>
              <select value={parentFolder} onChange={(e) => setParentFolder(e.target.value)}
                className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none">
                <option value="">-- None (top level) --</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.title}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving || !title.trim() || (type === 'Bookmark' && !href.trim())}
          className="px-5 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest disabled:opacity-50">
          {saving ? 'Saving...' : initial?.id ? 'Save changes' : type === 'Folder' ? 'Create folder' : 'Create bookmark'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
