// UserForm -- create an account directly, skipping registration. Used by
// AdminUserNewPage at /admin/users/new. Two things this has to get right that
// a plain form wouldn't:
//  - the username is a handle (it becomes @user@domain and the actor URL), so
//    it's validated as a slug here rather than letting the server 400;
//  - when no password is given the server generates one and returns it ONCE.
//    onCreated gets the full response so the page can show that password.

import { useState } from 'react'
import { useClient } from '../../../hooks/useClient'

const inputCls = 'w-full px-3 py-2 border-2 border-base-300 focus:border-primary bg-base-100 font-ui text-sm outline-none transition-colors'
const labelCls = 'font-ui text-xs uppercase tracking-widest text-base-content/50 mb-1 block'

export default function UserForm({ onCreated, onCancel }) {
  const client = useClient()
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const badUsername = username.length > 0 && !/^[a-z0-9_]{2,32}$/.test(username)
  const badPassword = password.length > 0 && password.length < 8
  const canSubmit = username.length > 0 && !badUsername && !badPassword && !busy

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const res = await client.admin.createUser({
        username,
        name: name || undefined,
        email: email || undefined,
        password: password || undefined,
      })
      onCreated(res)
    } catch (err) {
      setError(err?.message || 'Could not create user')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p role="alert" className="font-ui text-xs text-error">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Username</label>
          <input type="text" value={username} autoFocus
            onChange={(e) => setUsername(e.target.value)}
            placeholder="jane_doe" className={inputCls} />
          <p className={`font-reading text-xs italic mt-1 ${badUsername ? 'text-error' : 'text-base-content/40'}`}>
            {badUsername
              ? '2-32 characters, lowercase letters, numbers or underscores only.'
              : 'Becomes their handle and cannot be changed later.'}
          </p>
        </div>

        <div>
          <label className={labelCls}>Display name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com" className={inputCls} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>Password</label>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to generate one" className={inputCls} />
          <p className={`font-reading text-xs italic mt-1 ${badPassword ? 'text-error' : 'text-base-content/40'}`}>
            {badPassword ? 'At least 8 characters.' : 'Leave blank and a strong one is generated for you.'}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={!canSubmit}
          className="px-5 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed">
          {busy ? 'Creating...' : 'Create user'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}
