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

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminPagesPage() {
  const client = useClient()
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState('active')
  const [pending, setPending] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const { selected, toggle, selectAll, clear, isSelected, allSelected, someSelected, count } = useBatchSelect(pages)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      // limit 100: the whole list has to be here for drag-to-reorder.
      const params = { limit: 100 }
      if (filter === 'deleted') params.showDeleted = true
      const res = await client.admin.getPages(params)
      setPages(res?.orderedItems ?? [])
    } catch (err) {
      if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
    } finally {
      setLoading(false)
    }
  }, [client, filter])

  useEffect(() => { load() }, [load])
  useEffect(() => { clear() }, [filter])

  // Drag-to-reorder: show the new order straight away, then save it.
  const handleReorder = async (ids) => {
    setOrderError(null)
    setPages((prev) => applyOrder(prev, ids))
    try {
      await client.admin.reorderPages({ ids })
    } catch (err) {
      setOrderError(err?.message || "Couldn't save the new order.")
      load()
    }
  }

  const handleDelete = async (pageId) => {
    setPending(true)
    try {
      await client.admin.deletePage({ pageId })
      setPages((prev) => prev.map((p) => p.id === pageId ? { ...p, deletedAt: new Date().toISOString() } : p))
    } catch {}
    setPending(false)
  }

  const handleRestore = async (pageId) => {
    setPending(true)
    try {
      await client.admin.restorePage({ pageId })
      setPages((prev) => prev.map((p) => p.id === pageId ? { ...p, deletedAt: null } : p))
    } catch {}
    setPending(false)
  }

  const handleBatchSoftDelete = async () => {
    if (!confirm(`Soft-delete ${count} page(s)?`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deletePage({ pageId: id })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchHardDelete = async () => {
    if (!confirm(`Permanently delete ${count} page(s)? This cannot be undone.`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deletePage({ pageId: id, fullDelete: true })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchRestore = async () => {
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.restorePage({ pageId: id })))
    clear()
    await load()
    setPending(false)
  }

  if (denied) return (
    <div className="py-16 text-center"><p className="font-display text-3xl tracking-wide">Access Denied</p></div>
  )

  const FILTERS = [['active', 'Active'], ['deleted', 'Deleted']]

  return (
    <div>
      <AdminListHeader title="Pages" newTo="/admin/pages/new" newLabel="New Page" />

      <div className="flex gap-0 mb-4">
        {FILTERS.map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors ${
              filter === val ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <BatchActionBar count={count} filter={filter} busy={pending}
        onSoftDelete={handleBatchSoftDelete} onHardDelete={handleBatchHardDelete}
        onRestore={handleBatchRestore} onClear={clear} />

      {orderError && <p className="font-ui text-sm text-error mb-3">{orderError}</p>}
      {filter === 'active' && pages.length > 1 && (
        <p className="font-ui text-xs text-base-content/50 mb-3">Drag the handle to change the order pages appear in.</p>
      )}

      {loading ? <Spinner centered /> : (
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-base-300">
              <th className="pb-2 pr-2 w-6" />
              <th className="pb-2 pr-3 w-6">
                <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected }}
                  onChange={() => allSelected ? clear() : selectAll()}
                  className="cursor-pointer" />
              </th>
              {['Title', 'Type', 'Slug', 'Visibility', 'Date', ''].map((h) => (
                <th key={h} className="font-ui text-xs uppercase tracking-widest text-base-content/50 text-left pb-2 pr-4 last:pr-0">{h}</th>
              ))}
            </tr>
          </thead>
          <SortableTableBody
            items={pages}
            parentKey="parentId"
            enabled={filter === 'active'}
            onReorder={handleReorder}
            rowClassName={(p) => `border-b border-base-300 hover:bg-base-200 ${p.deletedAt ? 'opacity-50' : ''} ${isSelected(p.id) ? 'bg-secondary/10' : ''}`}
            empty={<tr><td colSpan={8} className="py-8 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">No pages found</td></tr>}
            renderCells={(p, { handle, depth }) => (
              <>
                <td className="py-3 pr-2">{handle}</td>
                <td className="py-3 pr-3">
                  <input type="checkbox" checked={isSelected(p.id)} onChange={() => toggle(p.id)} className="cursor-pointer" />
                </td>
                <td className={`py-3 pr-4 max-w-xs ${depth ? 'pl-6' : ''}`}>
                  <span className="flex items-center gap-1.5 min-w-0">
                    {depth > 0 && <span className="text-base-content/30 shrink-0">&#8627;</span>}
                    <Link to={`/admin/pages/${encodeURIComponent(p.id)}/edit`}
                      className="font-ui text-sm hover:text-primary transition-colors text-left truncate block max-w-xs">
                      {p.title}
                    </Link>
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className="font-ui text-xs uppercase tracking-widest px-2 py-0.5 bg-base-200">{p.type ?? 'Page'}</span>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-base-content/50 max-w-32 truncate">{p.slug ?? '--'}</td>
                <td className="py-3 pr-4 font-ui text-xs text-base-content/40 uppercase tracking-widest">{p.to ?? '--'}</td>
                <td className="py-3 pr-4 font-ui text-xs text-base-content/50 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                <td className="py-3 text-right whitespace-nowrap">
                  {p.slug && (
                    <Link to={`/pages/${p.slug}`}
                      className="p-1 text-base-content/30 hover:text-base-content transition-colors inline-block mr-1" title="View">
                      <ExternalLink size={13} />
                    </Link>
                  )}
                  {p.deletedAt ? (
                    <button onClick={() => handleRestore(p.id)} disabled={!!pending}
                      className="p-1 text-base-content/40 hover:text-success transition-colors disabled:opacity-30" title="Restore">
                      <RotateCcw size={14} />
                    </button>
                  ) : (
                    <button onClick={() => handleDelete(p.id)} disabled={!!pending}
                      className="p-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </>
            )}
          />
        </table>
        </div>
      )}
    </div>
  )
}
