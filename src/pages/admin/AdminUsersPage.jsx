import { Fragment, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Trash2, RotateCcw, Search, X, Ban } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { useBatchSelect } from '../../hooks/useBatchSelect'
import Spinner from '../../components/ui/Spinner'
import BatchActionBar from '../../components/admin/BatchActionBar'
import { useStaffRole } from '../../lib/staff'
import { AdminListHeader } from '../../components/admin/AdminPageHeader'
import { BAN_WARNING } from '../../components/admin/blocklistUtils'

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_MIN_CHARS = 2

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminUsersPage() {
  // Moderators can view, close and restore accounts -- not create, ban or erase.
  const isMod = useStaffRole() === 'mod'
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
  const viewerId = useSelector((state) => state.auth?.user?.id)
  const [banUser, setBanUser] = useState(null) // the user whose ban panel is open
  const [banReason, setBanReason] = useState('')
  const [banError, setBanError] = useState(null)
  const [notice, setNotice] = useState(null)
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

  const openBan = (u) => {
    setBanUser(u)
    setBanReason('')
    setBanError(null)
    setNotice(null)
  }

  // Banning = adding a local person to the server's Blocked list. The server
  // permanently deletes the account and their posts, keeps the username
  // reserved and bans their email. Not the same as Delete, which is reversible.
  const handleBan = async () => {
    if (!banUser) return
    setPending(true)
    setBanError(null)
    try {
      await client.admin.addToBlocklist({
        list: 'blocked',
        target: banUser.id,
        summary: banReason.trim() || undefined,
        confirmBan: true,
      })
      setNotice(`@${banUser.username} is banned. Their account and posts have been deleted.`)
      setBanUser(null)
      await load()
    } catch (err) {
      setBanError(err?.message || 'Could not ban this user.')
    } finally {
      setPending(false)
    }
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
    if (!confirm(`Permanently delete ${count} user(s) and everything they posted? This cannot be undone.`)) return
    setPending(true)
    const ids = [...selected]
    const results = await Promise.allSettled(ids.map((id) => client.admin.deleteUser({ userId: id, fullDelete: true })))
    // Some can be refused (admins, an admin who's the only one owning a
    // group) -- say which and why rather than failing silently.
    const refused = results
      .map((r, i) => (r.status === 'rejected' ? `${ids[i]}: ${r.reason?.message || 'failed'}` : null))
      .filter(Boolean)
    if (refused.length) alert(`Not deleted:\n\n${refused.join('\n')}`)
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
      <AdminListHeader
        title="Users"
        newTo={isMod ? undefined : '/admin/users/new'}
        newLabel="New user"
        aside={<span className="font-ui text-xs uppercase tracking-widest text-base-content/40">{total} total</span>}
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
        onSoftDelete={handleBatchSoftDelete} onHardDelete={isMod ? undefined : handleBatchHardDelete}
        onRestore={handleBatchRestore} onClear={clear} />

      {notice && <p className="font-ui text-sm text-success border-l-4 border-success pl-3 mb-4 break-words">{notice}</p>}

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
                <Fragment key={u.id}>
                <tr className={`border-b border-base-300 hover:bg-base-200 ${u.deletedAt ? 'opacity-50' : ''} ${isSelected(u.id) ? 'bg-secondary/10' : ''}`}>
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
                  <td className="py-3 text-right whitespace-nowrap">
                    {u.deletedAt ? (
                      <button onClick={() => handleRestore(u.id)} disabled={pending}
                        className="p-1 text-base-content/40 hover:text-success transition-colors disabled:opacity-30" title="Restore">
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <button onClick={() => handleDelete(u.id)} disabled={pending}
                        className="p-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30" title="Delete (can be restored)">
                        <Trash2 size={14} />
                      </button>
                    )}
                    {u.id !== viewerId && !isMod && (
                      <button onClick={() => (banUser?.id === u.id ? setBanUser(null) : openBan(u))} disabled={pending}
                        className="p-1 ml-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30" title="Ban (permanent)">
                        <Ban size={14} />
                      </button>
                    )}
                  </td>
                </tr>
                {banUser?.id === u.id && (
                  <tr className="border-b border-base-300">
                    <td colSpan={7} className="py-4">
                      <div className="border-2 border-error bg-error/5 p-4">
                        <p className="font-ui text-xs uppercase tracking-widest text-error mb-2">Ban @{u.username}</p>
                        <p className="font-reading text-base text-base-content">{BAN_WARNING(`@${u.username}`)}</p>
                        <p className="font-reading text-sm text-base-content/60 mt-2">
                          Their username stays reserved and their email address is banned. If you might want them back, use Delete instead -- it can be restored.
                        </p>
                        <label htmlFor={`ban-reason-${u.id}`} className="font-ui text-xs uppercase tracking-widest text-base-content/50 mt-4 mb-1 block">Reason</label>
                        <textarea
                          id={`ban-reason-${u.id}`}
                          value={banReason}
                          onChange={(e) => setBanReason(e.target.value)}
                          rows={2}
                          placeholder="Why are you banning them?"
                          className="w-full px-3 py-2 border-2 border-base-300 focus:border-primary bg-base-100 font-reading text-sm outline-none transition-colors"
                        />
                        <p className="font-reading text-xs text-base-content/40 italic mt-1">Shown on the Blocked list. If that list is public, so is this.</p>
                        {banError && <p className="font-ui text-sm text-error border-l-4 border-error pl-3 mt-3 break-words">{banError}</p>}
                        <div className="flex flex-wrap gap-3 mt-4">
                          <button type="button" onClick={handleBan} disabled={pending}
                            className="px-5 py-2 bg-error text-error-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
                            {pending ? 'Banning...' : `Ban @${u.username} permanently`}
                          </button>
                          <button type="button" onClick={() => setBanUser(null)} disabled={pending}
                            className="px-4 py-1.5 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 disabled:opacity-40 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
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
