// AdminInvitesPage -- list and deactivate invites. Creating one lives on
// AdminInviteNewPage.

import { useState, useEffect, useCallback } from 'react'
import { Trash2, Copy, Check, QrCode, Download, X } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'
import { AdminListHeader } from '../../components/admin/AdminPageHeader'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function QRModal({ invite, onClose }) {
  const [copied, setCopied] = useState(false)

  const handleSave = () => {
    const a = document.createElement('a')
    a.href = invite.qrCode
    a.download = `invite-${invite.code}.png`
    a.click()
  }

  const handleCopyImage = async () => {
    try {
      const res = await fetch(invite.qrCode)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback: copy the URL instead
      await navigator.clipboard.writeText(invite.url ?? invite.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/40" onClick={onClose}>
      <div className="bg-base-100 border-2 border-base-content p-6 flex flex-col gap-4 w-80" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-wide">Invite QR</h2>
          <button onClick={onClose} className="p-1 text-base-content/40 hover:text-base-content transition-colors">
            <X size={16} />
          </button>
        </div>

        <img src={invite.qrCode} alt="Invite QR code" className="w-full" />

        <p className="font-mono text-xs text-base-content/50 break-all">{invite.url ?? invite.code}</p>

        <div className="flex gap-2">
          <button onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest">
            <Download size={13} /> Save
          </button>
          <button onClick={handleCopyImage}
            className="flex items-center gap-2 px-4 py-2 border-2 border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handleCopy} className="p-1 text-base-content/30 hover:text-base-content transition-colors" title="Copy">
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

export default function AdminInvitesPage() {
  const client = useClient()
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState('active')
  const [pending, setPending] = useState(null)
  const [qrInvite, setQrInvite] = useState(null)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      const params = {}
      if (filter === 'active') params.active = true
      else if (filter === 'inactive') params.active = false
      const res = await client.admin.getInvites(params)
      setInvites(res?.orderedItems ?? [])
    } catch (err) {
      if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
    } finally {
      setLoading(false)
    }
  }, [client, filter])

  useEffect(() => { load() }, [load])

  const handleDeactivate = async (inviteId) => {
    if (!confirm('Deactivate this invite?')) return
    setPending(inviteId)
    try {
      await client.admin.deleteInvite({ inviteId })
      setInvites((prev) => prev.map((i) => i.id === inviteId ? { ...i, active: false } : i))
    } catch {}
    setPending(null)
  }

  if (denied) return (
    <div className="py-16 text-center"><p className="font-display text-3xl tracking-wide">Access Denied</p></div>
  )

  const FILTERS = [['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']]

  return (
    <div>
      {qrInvite && <QRModal invite={qrInvite} onClose={() => setQrInvite(null)} />}

      <AdminListHeader title="Invites" newTo="/admin/invites/new" newLabel="New Invite" />

      <div className="flex gap-0 mb-6">
        {FILTERS.map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors ${
              filter === val ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <Spinner centered /> : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-base-300">
              {['Type', 'Code', 'Recipient / Note', 'Redeemed', 'Expires', 'Status', ''].map((h) => (
                <th key={h} className="font-ui text-xs uppercase tracking-widest text-base-content/50 text-left pb-2 pr-4 last:pr-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id} className={`border-b border-base-300 hover:bg-base-200 ${!inv.active ? 'opacity-50' : ''}`}>
                <td className="py-3 pr-4">
                  <span className="font-ui text-xs uppercase tracking-widest px-2 py-0.5 bg-base-200">{inv.type}</span>
                </td>
                <td className="py-3 pr-4">
                  <span className="font-mono text-xs">{inv.code}</span>
                  <CopyButton text={inv.url ?? inv.code} />
                </td>
                <td className="py-3 pr-4 font-ui text-xs text-base-content/60 max-w-36 truncate">
                  {inv.email ?? inv.note ?? '—'}
                </td>
                <td className="py-3 pr-4 font-ui text-xs text-base-content/60">
                  {inv.type === 'open'
                    ? `${inv.redemptionCount ?? 0}${inv.maxRedemptions ? ` / ${inv.maxRedemptions}` : ''}`
                    : inv.usedAt ? fmtDate(inv.usedAt) : 'No'
                  }
                </td>
                <td className="py-3 pr-4 font-ui text-xs text-base-content/50 whitespace-nowrap">{fmtDate(inv.expiresAt)}</td>
                <td className="py-3 pr-4">
                  <span className={`font-ui text-xs uppercase tracking-widest px-2 py-0.5 ${inv.active ? 'bg-success/15 text-success' : 'bg-base-300 text-base-content/50'}`}>
                    {inv.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  {inv.qrCode && (
                    <button onClick={() => setQrInvite(inv)}
                      className="p-1 text-base-content/30 hover:text-base-content transition-colors mr-1" title="Show QR code">
                      <QrCode size={14} />
                    </button>
                  )}
                  {inv.active && (
                    <button onClick={() => handleDeactivate(inv.id)} disabled={pending === inv.id}
                      className="p-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30" title="Deactivate">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">No invites found</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
