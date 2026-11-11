import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, RotateCcw, ExternalLink, Compass } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { useBatchSelect } from '../../hooks/useBatchSelect'
import stripHtml from '../../lib/stripHtml'
import Spinner from '../../components/ui/Spinner'
import BatchActionBar from '../../components/admin/BatchActionBar'
import AddToDiscoveryModal from '../../components/discover/AddToDiscoveryModal'
import { AdminListHeader } from '../../components/admin/AdminPageHeader'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const TYPE_COLORS = {
  Note: 'bg-[#b76c00]/15 text-[#b76c00]',
  Article: 'bg-[#006893]/15 text-[#006893]',
  Media: 'bg-[#009084]/15 text-[#009084]',
  Link: 'bg-[#417843]/15 text-[#417843]',
  Event: 'bg-[#cc272e]/15 text-[#cc272e]',
}

// Mirrors the server's getServerActorId() fallback (`@${domain}`) — used only
// to decide whether to show the Edit affordance. The server is the source of
// truth: it 403s if a custom `actorId` setting makes this guess wrong.
function serverActorId(client) {
  try {
    return `@${new URL(client.http.baseUrl).host}`
  } catch {
    return null
  }
}

export default function AdminPostsPage() {
  const client = useClient()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState('active')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pending, setPending] = useState(false)
  const [discoveryItem, setDiscoveryItem] = useState(null)
  const { selected, toggle, selectAll, clear, isSelected, allSelected, someSelected, count } = useBatchSelect(posts)

  const ownActorId = serverActorId(client)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      const params = { page }
      if (filter === 'deleted') params.showDeleted = true
      const res = await client.admin.getPosts(params)
      setPosts(res?.orderedItems ?? [])
      setTotal(res?.totalItems ?? 0)
    } catch (err) {
      if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
    } finally {
      setLoading(false)
    }
  }, [client, filter, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { clear() }, [filter, page])

  const handleDelete = async (postId) => {
    setPending(true)
    try {
      await client.admin.deletePost({ postId })
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, deletedAt: new Date().toISOString() } : p))
    } catch {}
    setPending(false)
  }

  const handleRestore = async (postId) => {
    setPending(true)
    try {
      await client.admin.restorePost({ postId })
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, deletedAt: null } : p))
    } catch {}
    setPending(false)
  }

  const handleBatchSoftDelete = async () => {
    if (!confirm(`Soft-delete ${count} post(s)?`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deletePost({ postId: id })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchHardDelete = async () => {
    if (!confirm(`Permanently delete ${count} post(s)? This cannot be undone.`)) return
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.deletePost({ postId: id, fullDelete: true })))
    clear()
    await load()
    setPending(false)
  }

  const handleBatchRestore = async () => {
    setPending(true)
    await Promise.allSettled([...selected].map((id) => client.admin.restorePost({ postId: id })))
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
      <AdminListHeader title="Posts" newTo="/admin/posts/new" newLabel="New Post"
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
                {['ID', 'Type', 'Title / Content', 'Author', 'Date', 'Visibility', ''].map((h) => (
                  <th key={h} className="font-ui text-xs uppercase tracking-widest text-base-content/50 text-left pb-2 pr-4 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className={`border-b border-base-300 hover:bg-base-200 ${p.deletedAt ? 'opacity-50' : ''} ${isSelected(p.id) ? 'bg-secondary/10' : ''}`}>
                  <td className="py-3 pr-3">
                    <input type="checkbox" checked={isSelected(p.id)} onChange={() => toggle(p.id)} className="cursor-pointer" />
                  </td>
                  <td className="py-3 pr-4 max-w-32">
                    <Link
                      to={`/posts/${encodeURIComponent(p.id)}`}
                      title={p.id}
                      className="font-mono text-xs text-base-content/60 hover:text-primary transition-colors truncate block"
                    >
                      {p.id}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`font-ui text-xs uppercase tracking-widest px-2 py-0.5 ${TYPE_COLORS[p.type] ?? 'bg-base-200 text-base-content/60'}`}>
                      {p.type ?? '?'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 max-w-xs">
                    {(() => {
                      // || not ?? -- an empty-body Media post's stripHtml().slice() is "", which
                      // is non-nullish and would otherwise win over the "Untitled" fallback.
                      const label = p.title || p.name || p.summary || stripHtml(p.body).slice(0, 60) || <span className="italic text-base-content/40">Untitled</span>
                      // Only server-owned posts are editable (server 403s otherwise).
                      return !p.deletedAt && ownActorId && p.actorId === ownActorId ? (
                        <Link to={`/admin/posts/${encodeURIComponent(p.id)}/edit`}
                          className="font-ui text-sm line-clamp-1 text-base-content/80 hover:text-primary transition-colors">
                          {label}
                        </Link>
                      ) : (
                        <span className="font-ui text-sm line-clamp-1 text-base-content/80">{label}</span>
                      )
                    })()}
                  </td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50 max-w-28 truncate">{p.actorId}</td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                  <td className="py-3 pr-4">
                    <span className="font-ui text-xs uppercase tracking-widest text-base-content/40">{p.to ?? '—'}</span>
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <Link to={`/posts/${encodeURIComponent(p.id)}`} className="p-1 text-base-content/30 hover:text-base-content transition-colors inline-block mr-1" title="View">
                      <ExternalLink size={13} />
                    </Link>
                    {!p.deletedAt && (
                      <button onClick={() => setDiscoveryItem(p)}
                        className="p-1 text-base-content/30 hover:text-base-content transition-colors inline-block mr-1" title="Add to Discovery">
                        <Compass size={13} />
                      </button>
                    )}
                    {p.deletedAt ? (
                      <button onClick={() => handleRestore(p.id)} disabled={pending}
                        className="p-1 text-base-content/40 hover:text-success transition-colors disabled:opacity-30" title="Restore">
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <button onClick={() => handleDelete(p.id)} disabled={pending}
                        className="p-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">No posts found</td></tr>
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
        refType="Post"
        open={!!discoveryItem}
        onClose={() => setDiscoveryItem(null)}
      />
    </div>
  )
}
