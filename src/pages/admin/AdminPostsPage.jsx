import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, RotateCcw, ExternalLink, Plus, X, ImagePlus, Pencil, Compass } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { useBatchSelect } from '../../hooks/useBatchSelect'
import stripHtml from '../../lib/stripHtml'
import Spinner from '../../components/ui/Spinner'
import RichTextEditor from '../../components/posts/LazyRichTextEditor'
import BatchActionBar from '../../components/admin/BatchActionBar'
import AddToDiscoveryModal from '../../components/discover/AddToDiscoveryModal'

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

const VISIBILITY_OPTIONS = [
  { value: '@public', label: 'Public' },
  { value: '@server', label: 'Server only' },
]

// Admin-created posts are server announcements — Note or Article only.
// Link/Media/Event carry fields (href/target/attachments/event dates) the
// admin API doesn't accept yet, so they're not offered here.
const TYPE_OPTIONS = ['Note', 'Article']

function PostForm({ initial, onSave, onCancel }) {
  const client = useClient()
  const [type, setType] = useState(initial?.type && TYPE_OPTIONS.includes(initial.type) ? initial.type : 'Note')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.source?.content ?? '')
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [to, setTo] = useState(initial?.to || '@public')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(
    initial?.image
      ? (typeof initial.image === 'string' && initial.image.startsWith('file:')
          ? client.files.serveUrl(initial.image)
          : initial.image)
      : null
  )
  const [removeImage, setRemoveImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const imageInputRef = useRef(null)

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setRemoveImage(false)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(true)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let imageValue
      if (imageFile) {
        const res = await client.files.upload({
          file: imageFile,
          filename: imageFile.name,
          contentType: imageFile.type,
          to,
          generateThumbnail: true,
        })
        imageValue = res?.file?.id ?? res?.file?.url
      } else if (removeImage) {
        imageValue = null
      }

      const opts = {
        type,
        title: title || undefined,
        source: { content, mediaType: 'text/markdown' },
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        to,
        canReply: to,
        canReact: to,
        ...(imageValue !== undefined ? { image: imageValue } : {}),
      }

      let res
      if (initial?.id) {
        res = await client.admin.updatePost({ postId: initial.id, updates: opts })
        onSave(res.post)
      } else {
        res = await client.admin.createPost(opts)
        onSave(res.post)
      }
    } catch (err) {
      setError(
        err?.status === 403 || err?.statusCode === 403
          ? "Only posts this server created can be edited here."
          : err?.message || 'Failed to save post'
      )
    } finally {
      setSaving(false)
    }
  }

  const canSave = (title.trim() || content.trim()) && !saving

  return (
    <form onSubmit={handleSubmit} className="border-2 border-primary p-6 mb-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">{initial?.id ? 'Edit Post' : 'New Post'}</h2>
        <button type="button" onClick={onCancel} className="p-1 text-base-content/40 hover:text-base-content transition-colors">
          <X size={16} />
        </button>
      </div>

      {error && <p className="font-ui text-xs text-error">{error}</p>}

      <div className="flex gap-0">
        {TYPE_OPTIONS.map((t) => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors ${
              type === t ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {type !== 'Note' && (
          <div className="flex flex-col gap-1 col-span-2">
            <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
          </div>
        )}
        <div className="flex flex-col gap-1 col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Content</label>
          <RichTextEditor content={content} onChange={setContent} editorClassName="min-h-64" />
        </div>

        <div className="flex flex-col gap-2 col-span-2">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Featured Image</label>
          {imagePreview ? (
            <div className="relative w-full">
              <img src={imagePreview} alt="Featured" className="w-full max-h-48 object-cover" />
              <button type="button" onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-1 bg-base-100/90 text-base-content hover:text-error transition-colors" title="Remove image">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-base-300 hover:border-primary text-base-content/40 hover:text-primary transition-colors font-ui text-xs uppercase tracking-widest self-start">
              <ImagePlus size={14} /> Upload image
            </button>
          )}
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Tags</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated"
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-ui text-xs uppercase tracking-widest text-base-content/50">Visibility</label>
          <select value={to} onChange={(e) => setTo(e.target.value)}
            className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none">
            {VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={!canSave}
          className="px-5 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
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
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
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

  const handleSaved = (post) => {
    if (editing) {
      setPosts((prev) => prev.map((p) => p.id === post.id ? post : p))
      setEditing(null)
    } else {
      setPosts((prev) => [post, ...prev])
      setShowForm(false)
    }
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
      <div className="flex items-baseline justify-between border-b-2 border-base-300 pb-4 mb-6">
        <h1 className="font-display text-5xl tracking-wide">Posts</h1>
        <div className="flex items-center gap-4">
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/40">{total} total</span>
          <button onClick={() => { setShowForm((v) => !v); setEditing(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest">
            <Plus size={13} /> New Post
          </button>
        </div>
      </div>

      {showForm && !editing && (
        <PostForm onSave={handleSaved} onCancel={() => setShowForm(false)} />
      )}
      {editing && (
        <PostForm initial={editing} onSave={handleSaved} onCancel={() => setEditing(null)} />
      )}

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
                    <span className="font-ui text-sm line-clamp-1 text-base-content/80">
                      {/* || not ?? -- an empty-body Media post's stripHtml().slice() is "", which
                          is non-nullish and would otherwise win over the "Untitled" fallback. */}
                      {p.title || p.name || p.summary || stripHtml(p.body).slice(0, 60) || <span className="italic text-base-content/40">Untitled</span>}
                    </span>
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
                    {!p.deletedAt && ownActorId && p.actorId === ownActorId && (
                      <button onClick={() => { setEditing(p); setShowForm(false) }}
                        className="p-1 text-base-content/30 hover:text-base-content transition-colors inline-block mr-1" title="Edit">
                        <Pencil size={13} />
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
