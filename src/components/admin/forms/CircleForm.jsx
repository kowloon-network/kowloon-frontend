// CircleForm -- create or edit a server-owned Circle. Used by
// AdminCircleEditPage for both /admin/circles/new and /admin/circles/:id/edit.

import { useState, useRef } from 'react'
import { X, ImagePlus } from 'lucide-react'
import { useClient } from '../../../hooks/useClient'

const VISIBILITY_OPTIONS = [
  { value: '@public', label: 'Public' },
  { value: '@server', label: 'Server only' },
]

export default function CircleForm({ initial, onSave, onCancel }) {
  const client = useClient()
  const [name, setName] = useState(initial?.name ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [to, setTo] = useState(initial?.to || '@public')
  const [iconFile, setIconFile] = useState(null)
  const [iconPreview, setIconPreview] = useState(initial?.icon ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const iconInputRef = useRef(null)

  const handleIconChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIconFile(file)
    setIconPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let iconValue
      if (iconFile) {
        const res = await client.files.upload({
          file: iconFile,
          filename: iconFile.name,
          contentType: iconFile.type,
          to,
          generateThumbnail: true,
        })
        iconValue = res?.file?.url
      }

      const opts = {
        name,
        summary: summary || undefined,
        to,
        canReply: to,
        canReact: to,
        ...(iconValue ? { icon: iconValue } : {}),
      }

      let res
      if (initial?.id) {
        res = await client.admin.updateCircle({ circleId: initial.id, updates: opts })
        onSave(res.circle)
      } else {
        res = await client.admin.createCircle(opts)
        onSave(res.circle)
      }
    } catch (err) {
      setError(
        err?.status === 403 || err?.statusCode === 403
          ? "Only circles this server created can be edited here."
          : err?.message || 'Failed to save circle'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {error && <p className="font-ui text-xs text-error">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Summary</label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none resize-y" />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Icon</label>
          {iconPreview ? (
            <div className="relative w-24">
              <img src={iconPreview} alt="Icon" className="w-24 h-24 object-cover" />
              <button type="button" onClick={() => { setIconFile(null); setIconPreview(null) }}
                className="absolute top-1 right-1 p-1 bg-base-100/90 text-base-content hover:text-error transition-colors" title="Remove icon">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => iconInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-base-300 hover:border-primary text-base-content/40 hover:text-primary transition-colors font-ui text-xs uppercase tracking-widest self-start">
              <ImagePlus size={14} /> Upload icon
            </button>
          )}
          <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
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
        <button type="submit" disabled={saving || !name.trim()}
          className="px-5 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest disabled:opacity-50">
          {saving ? 'Saving...' : initial?.id ? 'Save changes' : 'Create circle'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
