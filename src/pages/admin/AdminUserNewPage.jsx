// AdminUserNewPage -- /admin/users/new. After creating, stays here so a
// server-generated password (returned ONCE, never recoverable) can be copied.
// Losing it strands the new account, so it's shown until the admin leaves.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check } from 'lucide-react'
import { AdminFormShell } from '../../components/admin/AdminPageHeader'
import UserForm from '../../components/admin/forms/UserForm'

function UserResult({ created, onBack, onAnother }) {
  const [copied, setCopied] = useState(false)

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(created.generatedPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the password is on screen to read regardless.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-reading text-sm">
        <span className="font-ui text-sm">{created.user?.username ? `@${created.user.username}` : created.user?.id}</span> is ready to use.
      </p>

      {created.generatedPassword ? (
        <div className="border-2 border-primary bg-base-200 p-4">
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/50 mb-1 block">Generated password</span>
          <div className="flex items-center gap-3">
            <code className="font-mono text-base break-all flex-1">{created.generatedPassword}</code>
            <button type="button" onClick={copyPassword} title="Copy to clipboard"
              className="shrink-0 p-2 text-base-content/60 hover:text-base-content transition-colors">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="font-reading text-xs text-base-content/60 italic mt-2">
            Shown only once, and never recoverable -- copy it now and give it to them.
            They can change it under Profile &amp; Settings.
          </p>
        </div>
      ) : (
        <p className="font-reading text-xs text-base-content/50 italic">
          They can sign in with the password you set.
        </p>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <button type="button" onClick={onBack}
          className="px-5 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest">
          Back to Users
        </button>
        <button type="button" onClick={onAnother}
          className="px-5 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
          Create another
        </button>
      </div>
    </div>
  )
}

export default function AdminUserNewPage() {
  const navigate = useNavigate()
  const [created, setCreated] = useState(null)
  const back = () => navigate('/admin/users')

  return (
    <AdminFormShell backTo="/admin/users" backLabel="Users" title={created ? 'User Created' : 'New User'}>
      {created ? (
        <UserResult created={created} onBack={back} onAnother={() => setCreated(null)} />
      ) : (
        <UserForm onCreated={setCreated} onCancel={back} />
      )}
    </AdminFormShell>
  )
}
