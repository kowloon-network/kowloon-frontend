// AdminCircleEditPage -- /admin/circles/new and /admin/circles/:id/edit.

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'
import { AdminFormShell } from '../../components/admin/AdminPageHeader'
import CircleForm from '../../components/admin/forms/CircleForm'

export default function AdminCircleEditPage() {
  const { id } = useParams()
  const isEdit = !!id
  const client = useClient()
  const navigate = useNavigate()
  const [circle, setCircle] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!client || !isEdit) return
    client.admin.getCircle({ circleId: id })
      .then((res) => setCircle(res?.circle ?? null))
      .catch((err) => setError(err?.message || "Couldn't load this circle."))
      .finally(() => setLoading(false))
  }, [client, id, isEdit])

  const done = () => navigate('/admin/circles')

  return (
    <AdminFormShell backTo="/admin/circles" backLabel="Circles" title={isEdit ? 'Edit Circle' : 'New Circle'}>
      {loading ? <Spinner centered /> : error || (isEdit && !circle) ? (
        <p className="font-ui text-sm text-error">{error || 'Circle not found.'}</p>
      ) : (
        <CircleForm initial={circle ?? undefined} onSave={done} onCancel={done} />
      )}
    </AdminFormShell>
  )
}
