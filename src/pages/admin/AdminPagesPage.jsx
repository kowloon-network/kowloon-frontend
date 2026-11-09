import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, RotateCcw, Plus, X, ExternalLink, ImagePlus } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { useBatchSelect } from '../../hooks/useBatchSelect'
import Spinner from '../../components/ui/Spinner'
import RichTextEditor from '../../components/posts/LazyRichTextEditor'
import BatchActionBar from '../../components/admin/BatchActionBar'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const VISIBILITY_OPTIONS = [
  { value: '@public', label: 'Public' },
  { value: '@server', label: 'Server only' },
]

function PageForm({ initial, allPages = [], onSave, onCancel }) {
  const client = useClient()
  const [type, setType] = useState(initial?.type ?? 'Page')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [content, setContent] = useState(initial?.source?.content ?? '')
  const [to, setTo] = useState(initial?.to ?? '@public')
  const [order, setOrder] = useState(initial?.order ?? 0)
  const [parentId, setParentId] = useState(initial?.parentId ?? '')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(initial?.image ?? null)
  const [removeImage, setRemoveImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const imageInputRef = useRef(null)

  // Pages eligible as parents: exclude self, exclude deleted
  const parentOptions = allPages.filter(
    (p) => p.id !== initial?.id && !p.deletedAt
  )

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setRemoveImage(false)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(true)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let imageValue = undefined
      if (imageFile) {
        const res = await client.files.upload({
          file: imageFile,
          filename: imageFile.name,
          contentType: imageFile.type,
          to,
          generateThumbnail: true,
        })
        imageValue = res?.file?.id ?? res?.file?.url
      } else if (removeImage) {
        imageValue = null
      }

      const opts = {
        type,
        title,
        slug: slug || undefined,
        summary: summary || undefined,
        source: content ? { content, mediaType: 'text/markdown' } : undefined,
        to,
        order: Number(order),
        parentId: parentId || null,
        ...(imageValue !== undefined || removeImage ? { image: imageValue } : {}),
      }
      let res
      if (initial?.id) {
        res = await client.admin.updatePage({ pageId: initial.id, updates: opts })
        onSave(res.page)
      } else {
        res = await client.admin.createPage(opts)
        onSave(res.page)
      }
    } catch (err) {
      setError(err?.message || 'Failed to save page')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-2 border-primary p-6 mb-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">{initial?.id ? 'Edit Page' : 'New Page'}</h2>
        <button type="button" onClick={onCancel} className="p-1 text-base-content/40 hover:text-base-content transition-colors">
          <X size={16} />
        </button>
      </div>

      {error && <p className="font-ui text-xs text-error">{error}</p>}

      <div className="flex gap-0">
        {['Page', 'Folder'].map((t) => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors ${
              type === t ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated"
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-mono text-sm outline-none" />
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Summary</label>
          <input value={summary} onChange={(e) => setSummary(e.target.value)}
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>
        {type === 'Page' && (
          <div className="flex flex-col gap-1 col-span-2">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Content</label>
            <RichTextEditor content={content} onChange={setContent} editorClassName="min-h-64" />
          </div>
        )}

        <div className="flex flex-col gap-2 col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Featured Image</label>
          {imagePreview ? (
            <div className="relative w-full">
              <img src={imagePreview} alt="Featured" className="w-full max-h-48 object-cover" />
              <button type="button" onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-1 bg-base-100/90 text-base-content hover:text-error transition-colors" title="Remove image">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-base-300 hover:border-primary text-base-content/40 hover:text-primary transition-colors font-ui text-xs uppercase tracking-widest self-start">
              <ImagePlus size={14} /> Upload image
            </button>
          )}
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Parent Page</label>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none">
            <option value="">— None (top-level) —</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.type === 'Folder' ? `[Folder] ${p.title}` : p.title}
              </option>
            ))}
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
        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Order</label>
          <input value={order} onChange={(e) => setOrder(e.target.value)} type="number"
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function AdminPagesPage() {
  const client = useClient()
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState('active')
  const [pending, setPending] = useState(false)
  // Deep-link from the dashboard's "Create Page" quick link (/admin/pages?new=1).
  const [showForm, setShowForm] = useState(() => new URLSearchParams(window.location.search).get('new') === '1')
  const [editing, setEditing] = useState(null)
  const { selected, toggle, selectAll, clear, isSelected, allSelected, someSelected, count } = useBatchSelect(pages)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      const params = {}
      if (filter === 'deleted') params.showDeleted = true
      const res = await client.admin.getPages(params)
      setPages(res?.orderedItems ?? [])
    } catch (err) {
      if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
    } finally {
      setLoading(false)
    }
  }, [client, filter])

  useEffect(() => { load() }, [load])
  useEffect(() => { clear() }, [filter])

  const handleDelete = async (pageId) => {
    setPending(true)
    try {
      await client.admin.deletePage({ pageId })
      setPages((prev) => prev.map((p) => p.id === pageId ? { ...p, deletedAt: new Date().toISOString() } : p))
    } catch {}
    setPending(false)
  }

  const handleRestore = async (pageId) => {
    setPending(true)
    try {
      await client.admin.restorePage({ pageId })
      setPages((prev) => prev.map((p) => p.id === pageId ? { ...p, deletedAt: null } : p))
    } catch {}
    setPending(false)
  }

  const handleSaved = (page) => {
    if (editing) {
      setPages((prev) => prev.map((p) => p.id === page.id ? page : p))
      setEditing(null)
    } else {
      setPages((prev) => [page, ...prev])
      setShowForm(false)
    }
  }

  const handleBatchSoftDelete = async () => {
    if (!confirm(`Soft-delete ${count} page(s)?`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deletePage({ pageId: id })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchHardDelete = async () => {
    if (!confirm(`Permanently delete ${count} page(s)? This cannot be undone.`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deletePage({ pageId: id, fullDelete: true })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchRestore = async () => {
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.restorePage({ pageId: id })))
    clear()
    await load()
    setPending(false)
  }

  if (denied) return (
    <div className="py-16 text-center"><p className="font-display text-3xl tracking-wide">Access Denied</p></div>
  )

  const FILTERS = [['active', 'Active'], ['deleted', 'Deleted']]

  return (
    <div>
      <div className="flex items-baseline justify-between border-b-2 border-base-300 pb-4 mb-6">
        <h1 className="font-display text-5xl tracking-wide">Pages</h1>
        <button onClick={() => { setShowForm((v) => !v); setEditing(null) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest">
          <Plus size={13} /> New Page
        </button>
      </div>

      {showForm && !editing && (
        <PageForm allPages={pages} onSave={handleSaved} onCancel={() => setShowForm(false)} />
      )}
      {editing && (
        <PageForm initial={editing} allPages={pages} onSave={handleSaved} onCancel={() => setEditing(null)} />
      )}

      <div className="flex gap-0 mb-4">
        {FILTERS.map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors ${
              filter === val ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <BatchActionBar count={count} filter={filter} busy={pending}
        onSoftDelete={handleBatchSoftDelete} onHardDelete={handleBatchHardDelete}
        onRestore={handleBatchRestore} onClear={clear} />

      {loading ? <Spinner centered /> : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-base-300">
              <th className="pb-2 pr-3 w-6">
                <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected }}
                  onChange={() => allSelected ? clear() : selectAll()}
                  className="cursor-pointer" />
              </th>
              {['Type', 'Title', 'Slug', 'Visibility', 'Order', 'Date', ''].map((h) => (
                <th key={h} className="font-ui text-xs uppercase tracking-widest text-base-content/50 text-left pb-2 pr-4 last:pr-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id} className={`border-b border-base-300 hover:bg-base-200 ${p.deletedAt ? 'opacity-50' : ''} ${isSelected(p.id) ? 'bg-secondary/10' : ''}`}>
                <td className="py-3 pr-3">
                  <input type="checkbox" checked={isSelected(p.id)} onChange={() => toggle(p.id)} className="cursor-pointer" />
                </td>
                <td className="py-3 pr-4">
                  <span className="font-ui text-xs uppercase tracking-widest px-2 py-0.5 bg-base-200">{p.type ?? 'Page'}</span>
                </td>
                <td className="py-3 pr-4 max-w-xs">
                  <button onClick={() => { setEditing(p); setShowForm(false) }}
                    className="font-ui text-sm hover:text-primary transition-colors text-left truncate block max-w-xs">
                    {p.title}
                  </button>
                  {p.parentId && (() => {
                    const parent = pages.find((q) => q.id === p.parentId)
                    return parent
                      ? <span className="font-ui text-[10px] uppercase tracking-widest text-base-content/35">↳ {parent.title}</span>
                      : null
                  })()}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-base-content/50 max-w-32 truncate">{p.slug ?? '—'}</td>
                <td className="py-3 pr-4 font-ui text-xs text-base-content/40 uppercase tracking-widest">{p.to ?? '—'}</td>
                <td className="py-3 pr-4 font-ui text-xs text-base-content/50">{p.order ?? 0}</td>
                <td className="py-3 pr-4 font-ui text-xs text-base-content/50 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                <td className="py-3 text-right whitespace-nowrap">
                  {p.slug && (
                    <Link to={`/pages/${p.slug}`}
                      className="p-1 text-base-content/30 hover:text-base-content transition-colors inline-block mr-1" title="View">
                      <ExternalLink size={13} />
                    </Link>
                  )}
                  {p.deletedAt ? (
                    <button onClick={() => handleRestore(p.id)} disabled={!!pending}
                      className="p-1 text-base-content/40 hover:text-success transition-colors disabled:opacity-30" title="Restore">
                      <RotateCcw size={14} />
                    </button>
                  ) : (
                    <button onClick={() => handleDelete(p.id)} disabled={!!pending}
                      className="p-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">No pages found</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
