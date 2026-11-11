// PageForm -- create or edit a server Page (or a Folder of pages). Used by
// AdminPageEditPage for both /admin/pages/new and /admin/pages/:id/edit.

import { useState, useRef } from 'react'
import { X, ImagePlus } from 'lucide-react'
import { useClient } from '../../../hooks/useClient'
import RichTextEditor from '../../posts/LazyRichTextEditor'

const VISIBILITY_OPTIONS = [
  { value: '@public', label: 'Public' },
  { value: '@server', label: 'Server only' },
]

export default function PageForm({ initial, allPages = [], onSave, onCancel }) {
  const client = useClient()
  const [type, setType] = useState(initial?.type ?? 'Page')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [content, setContent] = useState(initial?.source?.content ?? '')
  const [to, setTo] = useState(initial?.to ?? '@public')
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Summary</label>
          <input value={summary} onChange={(e) => setSummary(e.target.value)}
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>
        {type === 'Page' && (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Content</label>
            <RichTextEditor content={content} onChange={setContent} editorClassName="min-h-64" />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:col-span-2">
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
            <option value="">-- None (top-level) --</option>
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
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest disabled:opacity-50">
          {saving ? 'Saving...' : initial?.id ? 'Save changes' : 'Create page'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
