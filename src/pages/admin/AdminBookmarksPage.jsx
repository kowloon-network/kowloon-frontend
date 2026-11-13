import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, RotateCcw, ExternalLink } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { useBatchSelect } from '../../hooks/useBatchSelect'
import Spinner from '../../components/ui/Spinner'
import BatchActionBar from '../../components/admin/BatchActionBar'
import { AdminListHeader } from '../../components/admin/AdminPageHeader'
import SortableTableBody from '../../components/admin/SortableTableBody'
import { applyOrder } from '../../components/admin/sortOrder'
import { useStaffRole } from '../../lib/staff'

function fmtDate(d) {
  if (!d) return '--'
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

const PAGE_SIZE = 100

export default function AdminBookmarksPage() {
  const client = useClient()
  const isMod = useStaffRole() === 'mod' // moderators add and edit, but don't delete
  const [bookmarks, setBookmarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState('active')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pending, setPending] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const { selected, toggle, selectAll, clear, isSelected, allSelected, someSelected, count } = useBatchSelect(bookmarks)

  const ownActorId = serverActorId(client)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      // 100 per page so the whole list is usually here for drag-to-reorder.
      const params = { page, limit: PAGE_SIZE }
      if (filter === 'deleted') params.showDeleted = true
      const res = await client.admin.getBookmarks(params)
      setBookmarks(res?.orderedItems ?? [])
      setTotal(res?.totalItems ?? 0)
    } catch (err) {
      if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
    } finally {
      setLoading(false)
    }
  }, [client, filter, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { clear() }, [filter, page])

  // Drag-to-reorder: show the new order straight away, then save it.
  const handleReorder = async (ids) => {
    setOrderError(null)
    setBookmarks((prev) => applyOrder(prev, ids))
    try {
      await client.admin.reorderBookmarks({ ids })
    } catch (err) {
      setOrderError(err?.message || "Couldn't save the new order.")
      load()
    }
  }

  const handleDelete = async (bookmarkId) => {
    setPending(true)
    try {
      await client.admin.deleteBookmark({ bookmarkId })
      await load()
    } catch {}
    setPending(false)
  }

  const handleRestore = async (bookmarkId) => {
    setPending(true)
    try {
      await client.admin.restoreBookmark({ bookmarkId })
      await load()
    } catch {}
    setPending(false)
  }

  const handleBatchSoftDelete = async () => {
    if (!confirm(`Soft-delete ${count} bookmark(s)?`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deleteBookmark({ bookmarkId: id })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchHardDelete = async () => {
    if (!confirm(`Permanently delete ${count} bookmark(s)? This cannot be undone.`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deleteBookmark({ bookmarkId: id, fullDelete: true })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchRestore = async () => {
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.restoreBookmark({ bookmarkId: id })))
    clear()
    await load()
    setPending(false)
  }

  if (denied) return (
    <div className="py-16 text-center"><p className="font-display text-3xl tracking-wide">Access Denied</p></div>
  )

  const FILTERS = [['active', 'Active'], ['deleted', 'Deleted']]
  const pages = Math.ceil(total / PAGE_SIZE)
  // Reordering needs the whole list on screen.
  const canReorder = filter === 'active' && pages <= 1

  return (
    <div>
      <AdminListHeader title="Bookmarks" newTo="/admin/bookmarks/new" newLabel="New Bookmark"
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
          {orderError && <p className="font-ui text-sm text-error mb-3">{orderError}</p>}
          {canReorder && bookmarks.length > 1 && (
            <p className="font-ui text-xs text-base-content/50 mb-3">Drag the handle to change the order bookmarks appear in.</p>
          )}
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-base-300">
                <th className="pb-2 pr-2 w-6" />
                <th className="pb-2 pr-3 w-6">
                  <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={() => allSelected ? clear() : selectAll()} className="cursor-pointer" />
                </th>
                {['Title', 'Type', 'Created', 'Status', ''].map((h) => (
                  <th key={h} className="font-ui text-xs uppercase tracking-widest text-base-content/50 text-left pb-2 pr-4 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <SortableTableBody
              items={bookmarks}
              parentKey="parentFolder"
              enabled={canReorder}
              onReorder={handleReorder}
              rowClassName={(b) => `border-b border-base-300 hover:bg-base-200 ${b.deletedAt ? 'opacity-50' : ''} ${isSelected(b.id) ? 'bg-secondary/10' : ''}`}
              empty={<tr><td colSpan={7} className="py-8 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">No bookmarks found</td></tr>}
              renderCells={(b, { handle, depth }) => (
                <>
                  <td className="py-3 pr-2">{handle}</td>
                  <td className="py-3 pr-3">
                    <input type="checkbox" checked={isSelected(b.id)} onChange={() => toggle(b.id)} className="cursor-pointer" />
                  </td>
                  <td className={`py-3 pr-4 font-ui text-sm ${depth ? 'pl-6' : ''}`}>
                    <span className="flex items-center gap-1.5 min-w-0">
                      {depth > 0 && <span className="text-base-content/30 shrink-0">&#8627;</span>}
                      {/* Only server-owned bookmarks are editable (server 403s otherwise). */}
                      {!b.deletedAt && ownActorId && b.actorId === ownActorId ? (
                        <Link to={`/admin/bookmarks/${encodeURIComponent(b.id)}/edit`}
                          className="hover:text-primary transition-colors truncate">
                          {b.title ?? b.id}
                        </Link>
                      ) : <span className="truncate">{b.title ?? b.id}</span>}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50">{b.type}</td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50 whitespace-nowrap">{fmtDate(b.createdAt)}</td>
                  <td className="py-3 pr-4">
                    <span className={`font-ui text-xs uppercase tracking-widest px-2 py-0.5 ${b.deletedAt ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>
                      {b.deletedAt ? 'Deleted' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {b.type === 'Bookmark' && b.href && (
                      <a href={b.href} target="_blank" rel="noopener noreferrer"
                        className="p-1 text-base-content/30 hover:text-base-content transition-colors inline-block mr-1" title="Open link">
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {b.deletedAt ? (
                      <button onClick={() => handleRestore(b.id)} disabled={pending}
                        className="p-1 text-base-content/40 hover:text-success transition-colors disabled:opacity-30" title="Restore">
                        <RotateCcw size={14} />
                      </button>
                    ) : !isMod ? (
                      <button onClick={() => handleDelete(b.id)} disabled={pending}
                        className="p-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </td>
                </>
              )}
            />
          </table>
          </div>

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
