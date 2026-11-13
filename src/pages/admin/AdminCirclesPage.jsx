import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, RotateCcw, ExternalLink, Pencil, Compass } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { useBatchSelect } from '../../hooks/useBatchSelect'
import Spinner from '../../components/ui/Spinner'
import BatchActionBar from '../../components/admin/BatchActionBar'
import { AdminListHeader } from '../../components/admin/AdminPageHeader'
import AddToDiscoveryModal from '../../components/discover/AddToDiscoveryModal'
import { useStaffRole } from '../../lib/staff'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Mirrors the server's getServerActorId() fallback (`@${domain}`) -- used only
// to decide whether to show the Edit affordance. The server is the source of
// truth: it 403s if a custom `actorId` setting makes this guess wrong.
function serverActorId(client) {
  try {
    return `@${new URL(client.http.baseUrl).host}`
  } catch {
    return null
  }
}

export default function AdminCirclesPage() {
  const client = useClient()
  const isMod = useStaffRole() === 'mod' // moderators add and edit, but don't delete
  const [circles, setCircles] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState('active')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pending, setPending] = useState(false)
  const [discoveryItem, setDiscoveryItem] = useState(null)
  const { selected, toggle, selectAll, clear, isSelected, allSelected, someSelected, count } = useBatchSelect(circles)

  const ownActorId = serverActorId(client)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      const params = { page }
      if (filter === 'deleted') params.showDeleted = true
      const res = await client.admin.getCircles(params)
      setCircles(res?.orderedItems ?? [])
      setTotal(res?.totalItems ?? 0)
    } catch (err) {
      if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
    } finally {
      setLoading(false)
    }
  }, [client, filter, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { clear() }, [filter, page])

  const handleDelete = async (circleId) => {
    setPending(true)
    try {
      await client.admin.deleteCircle({ circleId })
      setCircles((prev) => prev.map((c) => c.id === circleId ? { ...c, deletedAt: new Date().toISOString() } : c))
    } catch {}
    setPending(false)
  }

  const handleRestore = async (circleId) => {
    setPending(true)
    try {
      await client.admin.restoreCircle({ circleId })
      setCircles((prev) => prev.map((c) => c.id === circleId ? { ...c, deletedAt: null } : c))
    } catch {}
    setPending(false)
  }

  const handleBatchSoftDelete = async () => {
    if (!confirm(`Soft-delete ${count} circle(s)?`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deleteCircle({ circleId: id })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchHardDelete = async () => {
    if (!confirm(`Permanently delete ${count} circle(s)? This cannot be undone.`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deleteCircle({ circleId: id, fullDelete: true })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchRestore = async () => {
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.restoreCircle({ circleId: id })))
    clear()
    await load()
    setPending(false)
  }

  if (denied) return (
    <div className="py-16 text-center"><p className="font-display text-3xl tracking-wide">Access Denied</p></div>
  )

  const FILTERS = [['active', 'Active'], ['deleted', 'Deleted']]
  const limit = 20
  const pages = Math.ceil(total / limit)

  return (
    <div>
      <AdminListHeader title="Circles" newTo="/admin/circles/new" newLabel="New Circle"
        aside={<span className="font-ui text-xs uppercase tracking-widest text-base-content/40">{total} total</span>} />

      <div className="flex gap-0 mb-4">
        {FILTERS.map(([val, label]) => (
          <button key={val} onClick={() => { setFilter(val); setPage(1) }}
            className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors ${
              filter === val ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <BatchActionBar count={count} filter={filter} busy={pending}
        onSoftDelete={isMod ? undefined : handleBatchSoftDelete} onHardDelete={isMod ? undefined : handleBatchHardDelete}
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
                {['Name', 'Creator', 'Members', 'Created', 'Status', ''].map((h) => (
                  <th key={h} className="font-ui text-xs uppercase tracking-widest text-base-content/50 text-left pb-2 pr-4 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {circles.map((c) => (
                <tr key={c.id} className={`border-b border-base-300 hover:bg-base-200 ${c.deletedAt ? 'opacity-50' : ''} ${isSelected(c.id) ? 'bg-secondary/10' : ''}`}>
                  <td className="py-3 pr-3">
                    <input type="checkbox" checked={isSelected(c.id)} onChange={() => toggle(c.id)} className="cursor-pointer" />
                  </td>
                  <td className="py-3 pr-4">
                    {/* Only server-owned items are editable; others link to the public view. */}
                    <Link to={!c.deletedAt && ownActorId && c.actorId === ownActorId
                      ? `/admin/circles/${encodeURIComponent(c.id)}/edit`
                      : `/circles/${encodeURIComponent(c.id)}`}
                      className="font-ui text-sm hover:text-primary transition-colors">
                      {c.name ?? c.id}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50 max-w-28 truncate">{c.actorId}</td>
                  <td className="py-3 pr-4 font-ui text-sm">{c.memberCount ?? '—'}</td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                  <td className="py-3 pr-4">
                    <span className={`font-ui text-xs uppercase tracking-widest px-2 py-0.5 ${c.deletedAt ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
                      {c.deletedAt ? 'Deleted' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <Link to={`/circles/${encodeURIComponent(c.id)}`}
                      className="p-1 text-base-content/30 hover:text-base-content transition-colors inline-block mr-1" title="View">
                      <ExternalLink size={13} />
                    </Link>
                    {!c.deletedAt && (
                      <button onClick={() => setDiscoveryItem(c)}
                        className="p-1 text-base-content/30 hover:text-base-content transition-colors inline-block mr-1" title="Add to Discovery">
                        <Compass size={13} />
                      </button>
                    )}
                    {!c.deletedAt && ownActorId && c.actorId === ownActorId && (
                      <Link to={`/admin/circles/${encodeURIComponent(c.id)}/edit`}
                        className="p-1 text-base-content/30 hover:text-base-content transition-colors inline-block mr-1" title="Edit">
                        <Pencil size={13} />
                      </Link>
                    )}
                    {c.deletedAt ? (
                      <button onClick={() => handleRestore(c.id)} disabled={pending}
                        className="p-1 text-base-content/40 hover:text-success transition-colors disabled:opacity-30" title="Restore">
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      !isMod && !c.deletedAt && ownActorId && c.actorId === ownActorId && (
                        <button onClick={() => handleDelete(c.id)} disabled={pending}
                          className="p-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
              {circles.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">No circles found</td></tr>
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

      <AddToDiscoveryModal
        item={discoveryItem}
        refType="Circle"
        open={!!discoveryItem}
        onClose={() => setDiscoveryItem(null)}
      />
    </div>
  )
}
