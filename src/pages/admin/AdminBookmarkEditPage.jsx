// AdminBookmarkEditPage -- /admin/bookmarks/new and /admin/bookmarks/:id/edit.

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'
import { AdminFormShell } from '../../components/admin/AdminPageHeader'
import BookmarkForm from '../../components/admin/forms/BookmarkForm'

export default function AdminBookmarkEditPage() {
  const { id } = useParams()
  const isEdit = !!id
  const client = useClient()
  const navigate = useNavigate()
  const [bookmark, setBookmark] = useState(null)
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!client) return
    Promise.all([
      // Top-level folders only, same as the list page's parent picker.
      client.admin.getBookmarks({ type: 'Folder' })
        .then((res) => setFolders((res?.orderedItems ?? []).filter((f) => !f.parentFolder)))
        .catch(() => {}),
      isEdit
        ? client.admin.getBookmark({ bookmarkId: id }).then((res) => setBookmark(res?.bookmark ?? null))
        : null,
    ])
      .catch((err) => setError(err?.message || "Couldn't load this bookmark."))
      .finally(() => setLoading(false))
  }, [client, id, isEdit])

  const done = () => navigate('/admin/bookmarks')

  return (
    <AdminFormShell backTo="/admin/bookmarks" backLabel="Bookmarks" title={isEdit ? 'Edit Bookmark' : 'New Bookmark'}>
      {loading ? <Spinner centered /> : error || (isEdit && !bookmark) ? (
        <p className="font-ui text-sm text-error">{error || 'Bookmark not found.'}</p>
      ) : (
        <BookmarkForm initial={bookmark ?? undefined}
          folders={folders.filter((f) => f.id !== bookmark?.id)}
          onSave={done} onCancel={done} />
      )}
    </AdminFormShell>
  )
}
