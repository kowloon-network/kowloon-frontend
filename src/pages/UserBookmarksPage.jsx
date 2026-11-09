// UserBookmarksPage — /users/:id/bookmarks
// Owner: flat fetch, tree built client-side.
// Non-owner: root items fetched initially; folder children lazy-loaded on expand.

import { useParams, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronDown, ExternalLink, Folder } from 'lucide-react'
import { useClient } from '../hooks/useClient'
import Spinner from '../components/ui/Spinner'
import ErrorState from '../components/ui/ErrorState'
import BookmarkActionMenu from '../components/bookmarks/BookmarkActionMenu'
import SafeHtml from '../components/ui/SafeHtml'

// ── BookmarkRow ───────────────────────────────────────────────────────────────

function BookmarkRow({ bookmark, isOwner, allFolders, onMutated }) {
  const href = bookmark.href ?? bookmark.target
  return (
    <div className="flex items-start gap-3 py-3 px-4 border-b border-base-300 last:border-b-0 hover:bg-base-200 transition-colors">
      {bookmark.image && (
        <img
          src={bookmark.image}
          alt=""
          className="w-10 h-10 object-cover shrink-0 mt-0.5"
        />
      )}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-ui text-sm text-primary hover:opacity-70 transition-opacity leading-snug"
          >
            {bookmark.title}
            <ExternalLink size={11} className="shrink-0 opacity-60" />
          </a>
        ) : (
          <span className="font-ui text-sm text-base-content leading-snug">{bookmark.title}</span>
        )}
        {bookmark.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {bookmark.tags.map((tag) => (
              <span key={tag} className="font-ui text-xs uppercase tracking-widest text-base-content/50 bg-base-300 px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}
        {bookmark.body && (
          <SafeHtml
            html={bookmark.body}
            className="prose prose-sm max-w-none text-base-content/70 text-xs mt-1 line-clamp-2"
          />
        )}
      </div>
      {isOwner && (
        <BookmarkActionMenu node={bookmark} allFolders={allFolders} onMutated={onMutated} />
      )}
    </div>
  )
}

// ── SubfolderNode ─────────────────────────────────────────────────────────────

function SubfolderNode({ subfolder, isOwner, userId, client, bookmarks, allFolders, onMutated }) {
  const [open, setOpen] = useState(false)
  const [lazyItems, setLazyItems] = useState(null)
  const [lazyLoading, setLazyLoading] = useState(false)
  const { t } = useTranslation()

  const handleToggle = async () => {
    const next = !open
    setOpen(next)
    if (next && !isOwner && lazyItems === null) {
      setLazyLoading(true)
      try {
        const res = await client.feeds.getUserBookmarks({ userId, parentFolder: subfolder.id })
        setLazyItems(res?.orderedItems ?? res ?? [])
      } catch {
        setLazyItems([])
      } finally {
        setLazyLoading(false)
      }
    }
  }

  const children = isOwner
    ? (bookmarks ?? []).filter((b) => b.parentFolder === subfolder.id)
    : (lazyItems ?? []).filter((i) => i.type === 'Bookmark')

  const count = isOwner ? children.length : (lazyItems ? lazyItems.filter(i => i.type === 'Bookmark').length : null)

  return (
    <div className="border-t border-base-300">
      <div className="w-full flex items-center bg-base-100 hover:bg-base-200 transition-colors">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-3 px-6 py-2.5 text-left flex-1 min-w-0"
        >
          {open ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
          <Folder size={12} className="shrink-0 text-base-content/50" />
          <span className="font-ui text-xs uppercase tracking-widest flex-1 truncate">{subfolder.title}</span>
          {count !== null && (
            <span className="font-ui text-xs text-base-content/40">{count}</span>
          )}
        </button>
        {isOwner && (
          <div className="pr-2">
            <BookmarkActionMenu node={subfolder} allFolders={allFolders} onMutated={onMutated} />
          </div>
        )}
      </div>

      {open && (
        <div className="pl-4">
          {lazyLoading ? (
            <div className="px-4 py-3"><Spinner /></div>
          ) : children.length > 0 ? (
            children.map((b) => <BookmarkRow key={b.id} bookmark={b} isOwner={isOwner} allFolders={allFolders} onMutated={onMutated} />)
          ) : (
            <p className="font-ui text-xs uppercase tracking-widest text-base-content/40 px-4 py-3">
              {t('bookmark.empty', { defaultValue: 'No bookmarks' })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── FolderNode ────────────────────────────────────────────────────────────────

function FolderNode({ folder, isOwner, userId, client, bookmarks, subfolders, allFolders, onMutated }) {
  const [open, setOpen] = useState(false)
  const [lazyItems, setLazyItems] = useState(null)
  const [lazyLoading, setLazyLoading] = useState(false)
  const { t } = useTranslation()

  const handleToggle = async () => {
    const next = !open
    setOpen(next)
    if (next && !isOwner && lazyItems === null) {
      setLazyLoading(true)
      try {
        const res = await client.feeds.getUserBookmarks({ userId, parentFolder: folder.id })
        setLazyItems(res?.orderedItems ?? res ?? [])
      } catch {
        setLazyItems([])
      } finally {
        setLazyLoading(false)
      }
    }
  }

  // Owner: derive children from the flat prop lists.
  // Non-owner: use lazy-loaded items, split by type.
  const folderBookmarks = isOwner
    ? (bookmarks ?? []).filter((b) => b.parentFolder === folder.id)
    : (lazyItems ?? []).filter((i) => i.type === 'Bookmark')

  const folderSubfolders = isOwner
    ? (subfolders ?? []).filter((sf) => sf.parentFolder === folder.id)
    : (lazyItems ?? []).filter((i) => i.type === 'Folder')

  const childCount = isOwner
    ? folderBookmarks.length + folderSubfolders.length
    : (lazyItems ? lazyItems.length : null)

  return (
    <div className="border border-base-300">
      <div className="w-full flex items-center bg-base-200 hover:bg-base-300 transition-colors">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-3 px-4 py-3 text-left flex-1 min-w-0"
        >
          {open ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
          <Folder size={14} className="shrink-0 text-base-content/60" />
          <span className="font-ui text-sm uppercase tracking-widest font-medium flex-1 truncate">{folder.title}</span>
          {childCount !== null && (
            <span className="font-ui text-xs text-base-content/45">{childCount}</span>
          )}
        </button>
        {isOwner && (
          <div className="pr-2">
            <BookmarkActionMenu node={folder} allFolders={allFolders} onMutated={onMutated} />
          </div>
        )}
      </div>

      {open && (
        <div>
          {lazyLoading ? (
            <div className="px-4 py-3"><Spinner /></div>
          ) : (
            <>
              {folderSubfolders.map((sf) => (
                <SubfolderNode
                  key={sf.id}
                  subfolder={sf}
                  isOwner={isOwner}
                  userId={userId}
                  client={client}
                  bookmarks={isOwner ? bookmarks : null}
                  allFolders={allFolders}
                  onMutated={onMutated}
                />
              ))}
              {folderBookmarks.length > 0 ? (
                folderBookmarks.map((b) => <BookmarkRow key={b.id} bookmark={b} isOwner={isOwner} allFolders={allFolders} onMutated={onMutated} />)
              ) : folderSubfolders.length === 0 ? (
                <p className="font-ui text-xs uppercase tracking-widest text-base-content/40 px-4 py-3">
                  {t('bookmark.empty', { defaultValue: 'No bookmarks' })}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UserBookmarksPage() {
  const { id } = useParams()
  const client = useClient()
  const authUser = useSelector((state) => state.auth.user)
  const { t } = useTranslation()

  const [user, setUser]       = useState(null)
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const isOwner = !!authUser && authUser.id === id

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    setError(null)
    try {
      const [userRes, bookmarksRes] = await Promise.all([
        client.feeds.getUser({ userId: id }),
        client.feeds.getUserBookmarks({ userId: id }),
      ])
      const raw = userRes?.item ?? userRes
      setUser({
        id: raw?.id,
        name: raw?.name ?? raw?.preferredUsername ?? raw?.username,
        icon: raw?.icon ?? raw?.profile?.icon,
      })
      setItems(bookmarksRes?.orderedItems ?? bookmarksRes ?? [])
    } catch (err) {
      setError(err.message || 'Failed to load bookmarks.')
    } finally {
      setLoading(false)
    }
  }, [client, id])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner centered />
  if (error)   return <ErrorState message={error} onRetry={load} />

  // Owner gets a flat list of everything; build tree client-side.
  // Non-owner gets only root-level items; folder children are lazy-loaded.
  const folders       = items.filter((i) => i.type === 'Folder' && !i.parentFolder)
  const subfolders    = items.filter((i) => i.type === 'Folder' && i.parentFolder)
  const allFolders    = items.filter((i) => i.type === 'Folder')
  const bookmarks     = items.filter((i) => i.type === 'Bookmark')
  const rootBookmarks = bookmarks.filter((b) => !b.parentFolder)

  return (
    <div className="flex flex-col gap-6">

      <div className="flex flex-col gap-1">
        <Link
          to={`/users/${encodeURIComponent(id)}`}
          className="font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-primary transition-colors self-start"
        >
          {'←'} {user?.name ?? id}
        </Link>
        <h1 className="font-display text-4xl tracking-wide">
          {t('bookmark.bookmarks', { defaultValue: 'Bookmarks' })}
        </h1>
      </div>

      {items.length === 0 ? (
        <p className="font-ui text-sm uppercase tracking-widest text-base-content/50">
          {isOwner
            ? t('bookmark.emptyOwn', { defaultValue: 'You have no bookmarks yet.' })
            : t('bookmark.emptyOther', { defaultValue: 'No public bookmarks.' })}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {folders.map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              isOwner={isOwner}
              userId={id}
              client={client}
              bookmarks={bookmarks}
              subfolders={subfolders}
              allFolders={allFolders}
              onMutated={load}
            />
          ))}

          {rootBookmarks.length > 0 && (
            <div className="flex flex-col border border-base-300">
              <div className="px-4 py-2 bg-base-200 border-b border-base-300">
                <span className="font-ui text-xs uppercase tracking-widest text-base-content/60">
                  {t('bookmark.unsorted', { defaultValue: 'Unsorted' })}
                </span>
              </div>
              {rootBookmarks.map((b) => <BookmarkRow key={b.id} bookmark={b} isOwner={isOwner} allFolders={allFolders} onMutated={load} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
