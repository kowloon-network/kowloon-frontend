// AdminCircleEditPage -- /admin/circles/new and /admin/circles/:id/edit.

import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  // A new circle is empty: go straight to its page to add members.
  const saved = (c) => (!isEdit && c?.id ? navigate(`/circles/${encodeURIComponent(c.id)}`) : done())

  return (
    <AdminFormShell backTo="/admin/circles" backLabel="Circles" title={isEdit ? 'Edit Circle' : 'New Circle'}>
      {loading ? <Spinner centered /> : error || (isEdit && !circle) ? (
        <p className="font-ui text-sm text-error">{error || 'Circle not found.'}</p>
      ) : (
        <>
          {isEdit && (
            <p className="font-ui text-sm text-base-content/60 mb-6">
              {circle.memberCount ?? circle.members?.length ?? 0} members.{' '}
              <Link to={`/circles/${encodeURIComponent(circle.id)}`} className="text-primary hover:underline">
                Add or remove members
              </Link>{' '}
              on the circle's page.
            </p>
          )}
          <CircleForm initial={circle ?? undefined} onSave={saved} onCancel={done} />
        </>
      )}
    </AdminFormShell>
  )
}
