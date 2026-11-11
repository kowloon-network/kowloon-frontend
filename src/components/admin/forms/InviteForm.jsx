// InviteForm -- create an individual (email) or open invite. Used by
// AdminInviteNewPage at /admin/invites/new.

import { useState } from 'react'
import { useClient } from '../../../hooks/useClient'

export default function InviteForm({ onCreated, onCancel }) {
  const client = useClient()
  const [type, setType] = useState('individual')
  const [email, setEmail] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const options = { type, note: note || undefined, expiresAt: expiresAt || undefined }
      if (type === 'individual') options.email = email
      if (type === 'open' && maxRedemptions) options.maxRedemptions = Number(maxRedemptions)
      const res = await client.admin.createInvite(options)
      onCreated(res.invite)
    } catch (err) {
      setError(err?.message || 'Failed to create invite')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="font-ui text-xs text-error">{error}</p>}

      <div className="flex gap-0">
        {['individual', 'open'].map((t) => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors ${
              type === t ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {type === 'individual' && (
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Email *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email"
              className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
          </div>
        )}
        {type === 'open' && (
          <div className="flex flex-col gap-1">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Max Redemptions</label>
            <input value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} type="number" min="1"
              placeholder="Unlimited"
              className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Expires</label>
          <input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} type="date"
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest disabled:opacity-50">
          {saving ? 'Creating...' : 'Create invite'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
