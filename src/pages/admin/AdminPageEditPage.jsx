// AdminPageEditPage -- /admin/pages/new and /admin/pages/:id/edit.

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'
import { AdminFormShell } from '../../components/admin/AdminPageHeader'
import PageForm from '../../components/admin/forms/PageForm'

export default function AdminPageEditPage() {
  const { id } = useParams()
  const isEdit = !!id
  const client = useClient()
  const navigate = useNavigate()
  const [page, setPage] = useState(null)
  const [allPages, setAllPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!client) return
    Promise.all([
      client.admin.getPages().then((res) => setAllPages(res?.orderedItems ?? [])).catch(() => {}),
      isEdit
        ? client.admin.getPage({ pageId: id }).then((res) => setPage(res?.page ?? null))
        : null,
    ])
      .catch((err) => setError(err?.message || "Couldn't load this page."))
      .finally(() => setLoading(false))
  }, [client, id, isEdit])

  const done = () => navigate('/admin/pages')

  return (
    <AdminFormShell backTo="/admin/pages" backLabel="Pages" title={isEdit ? 'Edit Page' : 'New Page'}>
      {loading ? <Spinner centered /> : error || (isEdit && !page) ? (
        <p className="font-ui text-sm text-error">{error || 'Page not found.'}</p>
      ) : (
        <PageForm initial={page ?? undefined} allPages={allPages} onSave={done} onCancel={done} />
      )}
    </AdminFormShell>
  )
}
