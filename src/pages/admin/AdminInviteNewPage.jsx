// AdminInviteNewPage -- /admin/invites/new. After creating, stays here and
// shows the invite link and QR code so the admin can hand them out.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check, Download } from 'lucide-react'
import { AdminFormShell } from '../../components/admin/AdminPageHeader'
import InviteForm from '../../components/admin/forms/InviteForm'

function InviteResult({ invite, onBack, onAnother }) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedQr, setCopiedQr] = useState(false)
  const link = invite.url ?? invite.code

  const flash = (set) => { set(true); setTimeout(() => set(false), 1500) }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      flash(setCopiedLink)
    } catch {
      // Clipboard can be blocked; the link is on screen to read regardless.
    }
  }

  const saveQr = () => {
    const a = document.createElement('a')
    a.href = invite.qrCode
    a.download = `invite-${invite.code}.png`
    a.click()
  }

  const copyQr = async () => {
    try {
      const res = await fetch(invite.qrCode)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      flash(setCopiedQr)
    } catch {
      // Fallback: copy the URL instead
      await navigator.clipboard.writeText(link)
      flash(setCopiedQr)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="font-reading text-sm">
        Invite created{invite.email ? <> for <span className="font-ui">{invite.email}</span></> : null}.
      </p>

      <div className="flex flex-col gap-1">
        <span className="font-ui text-xs uppercase tracking-widest text-base-content/50">Invite link</span>
        <div className="flex items-center gap-3 border-2 border-base-300 bg-base-200 px-3 py-2">
          <code className="font-mono text-sm break-all flex-1">{link}</code>
          <button type="button" onClick={copyLink} title="Copy link"
            className="shrink-0 p-1 text-base-content/60 hover:text-base-content transition-colors">
            {copiedLink ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {invite.qrCode && (
        <div className="flex flex-col gap-3">
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/50">QR code</span>
          <img src={invite.qrCode} alt="Invite QR code" className="w-64 max-w-full border border-base-300" />
          <div className="flex gap-2">
            <button type="button" onClick={saveQr}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest">
              <Download size={13} /> Save
            </button>
            <button type="button" onClick={copyQr}
              className="flex items-center gap-2 px-4 py-2 border-2 border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
              {copiedQr ? <Check size={13} /> : <Copy size={13} />}
              {copiedQr ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2 border-t border-base-300">
        <button type="button" onClick={onBack}
          className="mt-3 px-5 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest">
          Back to Invites
        </button>
        <button type="button" onClick={onAnother}
          className="mt-3 px-5 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
          Create another
        </button>
      </div>
    </div>
  )
}

export default function AdminInviteNewPage() {
  const navigate = useNavigate()
  const [created, setCreated] = useState(null)
  const back = () => navigate('/admin/invites')

  return (
    <AdminFormShell backTo="/admin/invites" backLabel="Invites" title={created ? 'Invite Created' : 'New Invite'}>
      {created ? (
        <InviteResult invite={created} onBack={back} onAnother={() => setCreated(null)} />
      ) : (
        <InviteForm onCreated={setCreated} onCancel={back} />
      )}
    </AdminFormShell>
  )
}
