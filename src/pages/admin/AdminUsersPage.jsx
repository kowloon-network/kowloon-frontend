import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, RotateCcw, Search, X, Plus, Copy, Check } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { useBatchSelect } from '../../hooks/useBatchSelect'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import BatchActionBar from '../../components/admin/BatchActionBar'

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_MIN_CHARS = 2

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Create an account directly, skipping registration. Two things this has to
// get right that a plain form wouldn't:
//  - the username is a handle (it becomes @user@domain and the actor URL), so
//    it's validated as a slug here rather than letting the server 400;
//  - when no password is given the server generates one and returns it ONCE.
//    Losing it strands the new account, which is exactly the hole this whole
//    feature came out of, so it's shown until dismissed and is copyable.
function NewUserModal({ open, onClose, client, onCreated }) {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setUsername(''); setName(''); setEmail(''); setPassword('')
    setError(null); setCreated(null); setCopied(false)
  }

  const handleClose = () => { reset(); onClose() }

  const badUsername = username.length > 0 && !/^[a-z0-9_]{2,32}$/.test(username)
  const badPassword = password.length > 0 && password.length < 8
  const canSubmit = username.length > 0 && !badUsername && !badPassword && !busy

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await client.admin.createUser({
        username,
        name: name || undefined,
        email: email || undefined,
        password: password || undefined,
      })
      setCreated(res)
      onCreated()
    } catch (err) {
      setError(err?.message || 'Could not create user')
    } finally {
      setBusy(false)
    }
  }

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(created.generatedPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the password is on screen to read regardless.
    }
  }

  const inputCls = 'w-full px-3 py-2 border-2 border-base-300 focus:border-primary bg-base-100 font-ui text-sm outline-none transition-colors'
  const labelCls = 'font-ui text-xs uppercase tracking-widest text-base-content/50 mb-1 block'

  return (
    <Modal open={open} onClose={handleClose} title={created ? 'User created' : 'New user'}>
      {created ? (
        <div className="flex flex-col gap-4">
          <p className="font-reading text-sm">
            <span className="font-ui text-sm">{created.user?.id}</span> is ready to use.
          </p>

          {created.generatedPassword ? (
            <div className="border-2 border-primary bg-base-200 p-4">
              <span className={labelCls}>Generated password</span>
              <div className="flex items-center gap-3">
                <code className="font-mono text-base break-all flex-1">{created.generatedPassword}</code>
                <button
                  type="button"
                  onClick={copyPassword}
                  title="Copy to clipboard"
                  className="shrink-0 p-2 text-base-content/60 hover:text-base-content transition-colors"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <p className="font-reading text-xs text-base-content/60 italic mt-2">
                Shown once, and never recoverable — copy it now and give it to them.
                They can change it under Profile &amp; Settings.
              </p>
            </div>
          ) : (
            <p className="font-reading text-xs text-base-content/50 italic">
              They can sign in with the password you set.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={reset}
              className="px-4 py-2 font-ui text-xs uppercase tracking-widest border-2 border-base-300 hover:bg-base-200 transition-colors">
              Create another
            </button>
            <button type="button" onClick={handleClose}
              className="px-6 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Username</label>
            <input type="text" value={username} autoFocus
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jane_doe" className={inputCls} />
            <p className={`font-reading text-xs italic mt-1 ${badUsername ? 'text-error' : 'text-base-content/40'}`}>
              {badUsername
                ? '2–32 characters, lowercase letters, numbers or underscores only.'
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

          <div>
            <label className={labelCls}>Password</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to generate one" className={inputCls} />
            <p className={`font-reading text-xs italic mt-1 ${badPassword ? 'text-error' : 'text-base-content/40'}`}>
              {badPassword ? 'At least 8 characters.' : 'Leave blank and a strong one is generated for you.'}
            </p>
          </div>

          <div className="flex items-center justify-end gap-4 pt-2">
            {error && (
              <span role="alert" className="font-ui text-xs uppercase tracking-widest text-error">{error}</span>
            )}
            <button type="button" onClick={handleClose}
              className="px-4 py-2 font-ui text-xs uppercase tracking-widest border-2 border-base-300 hover:bg-base-200 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={!canSubmit}
              className="px-6 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
              {busy ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function AdminUsersPage() {
  const client = useClient()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState('active')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pending, setPending] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const { selected, toggle, selectAll, clear, isSelected, allSelected, someSelected, count } = useBatchSelect(users)

  // Debounced, and only actually searches once there's nothing (cleared) or
  // at least SEARCH_MIN_CHARS -- a lone first character just waits rather
  // than firing a near-useless single-letter query.
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed.length > 0 && trimmed.length < SEARCH_MIN_CHARS) return
    const t = setTimeout(() => setSearch(trimmed), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      const params = { page }
      if (filter === 'deleted') params.showDeleted = true
      else if (filter === 'all') params.deleted = 'include'
      if (search) params.search = search
      const res = await client.admin.getUsers(params)
      setUsers(res?.orderedItems ?? [])
      setTotal(res?.totalItems ?? 0)
    } catch (err) {
      if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
    } finally {
      setLoading(false)
    }
  }, [client, filter, page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { clear() }, [filter, page, search])
  useEffect(() => { setPage(1) }, [search])

  const handleDelete = async (userId) => {
    setPending(true)
    try {
      await client.admin.deleteUser({ userId })
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, deletedAt: new Date().toISOString(), active: false } : u))
    } catch {}
    setPending(false)
  }

  const handleRestore = async (userId) => {
    setPending(true)
    try {
      await client.admin.restoreUser({ userId })
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, deletedAt: null, active: true } : u))
    } catch {}
    setPending(false)
  }

  const handleBatchSoftDelete = async () => {
    if (!confirm(`Soft-delete ${count} user(s)?`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deleteUser({ userId: id })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchHardDelete = async () => {
    if (!confirm(`Permanently delete ${count} user(s)? This cannot be undone.`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deleteUser({ userId: id, fullDelete: true })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchRestore = async () => {
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.restoreUser({ userId: id })))
    clear()
    await load()
    setPending(false)
  }

  if (denied) return (
    <div className="py-16 text-center"><p className="font-display text-3xl tracking-wide">Access Denied</p></div>
  )

  const FILTERS = [['active', 'Active'], ['deleted', 'Deleted'], ['all', 'All']]
  const limit = 20
  const pages = Math.ceil(total / limit)

  return (
    <div>
      <div className="flex items-baseline justify-between border-b-2 border-base-300 pb-4 mb-6">
        <h1 className="font-display text-5xl tracking-wide">Users</h1>
        <div className="flex items-baseline gap-5">
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/40">{total} total</span>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            <Plus size={13} />
            New user
          </button>
        </div>
      </div>

      <NewUserModal
        open={showNew}
        onClose={() => setShowNew(false)}
        client={client}
        onCreated={load}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-0">
          {FILTERS.map(([val, label]) => (
            <button key={val} onClick={() => { setFilter(val); setPage(1) }}
              className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors ${
                filter === val ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, username, ID…"
            className="w-full pl-8 pr-8 py-2 border border-base-300 focus:border-primary bg-base-100 font-ui text-sm outline-none"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <BatchActionBar count={count} filter={filter} busy={pending}
        onSoftDelete={handleBatchSoftDelete} onHardDelete={handleBatchHardDelete}
        onRestore={handleBatchRestore} onClear={clear} />

      {loading ? <Spinner centered /> : (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-base-300">
                <th className="pb-2 pr-3 w-6">
                  <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={() => allSelected ? clear() : selectAll()} className="cursor-pointer" />
                </th>
                {['Username', 'Display Name', 'ID', 'Joined', 'Status', ''].map((h) => (
                  <th key={h} className="font-ui text-xs uppercase tracking-widest text-base-content/50 text-left pb-2 pr-4 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-b border-base-300 hover:bg-base-200 ${u.deletedAt ? 'opacity-50' : ''} ${isSelected(u.id) ? 'bg-secondary/10' : ''}`}>
                  <td className="py-3 pr-3">
                    <input type="checkbox" checked={isSelected(u.id)} onChange={() => toggle(u.id)} className="cursor-pointer" />
                  </td>
                  <td className="py-3 pr-4 font-ui text-sm">
                    <Link to={`/users/${encodeURIComponent(u.id)}`} className="hover:text-primary transition-colors">
                      @{u.username}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-ui text-sm">{u.profile?.name ?? '—'}</td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50 max-w-32 truncate">{u.id}</td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                  <td className="py-3 pr-4">
                    <span className={`font-ui text-xs uppercase tracking-widest px-2 py-0.5 ${u.deletedAt ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
                      {u.deletedAt ? 'Deleted' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {u.deletedAt ? (
                      <button onClick={() => handleRestore(u.id)} disabled={pending}
                        className="p-1 text-base-content/40 hover:text-success transition-colors disabled:opacity-30" title="Restore">
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <button onClick={() => handleDelete(u.id)} disabled={pending}
                        className="p-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">No users found</td></tr>
              )}
            </tbody>
          </table>

          {pages > 1 && (
            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="font-ui text-xs uppercase tracking-widest px-3 py-1.5 border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors">
                Prev
              </button>
              <span className="font-ui text-xs text-base-content/50">{page} / {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                className="font-ui text-xs uppercase tracking-widest px-3 py-1.5 border border-base-300 disabled:opacity-30 hover:bg-base-200 transition-colors">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
