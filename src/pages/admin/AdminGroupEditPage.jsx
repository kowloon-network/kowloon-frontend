// AdminGroupEditPage -- /admin/groups/new and /admin/groups/:id/edit.

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'
import { AdminFormShell } from '../../components/admin/AdminPageHeader'
import GroupForm from '../../components/admin/forms/GroupForm'

export default function AdminGroupEditPage() {
  const { id } = useParams()
  const isEdit = !!id
  const client = useClient()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!client || !isEdit) return
    client.admin.getGroup({ groupId: id })
      .then((res) => setGroup(res?.group ?? null))
      .catch((err) => setError(err?.message || "Couldn't load this group."))
      .finally(() => setLoading(false))
  }, [client, id, isEdit])

  const done = () => navigate('/admin/groups')

  return (
    <AdminFormShell backTo="/admin/groups" backLabel="Groups" title={isEdit ? 'Edit Group' : 'New Group'}>
      {loading ? <Spinner centered /> : error || (isEdit && !group) ? (
        <p className="font-ui text-sm text-error">{error || 'Group not found.'}</p>
      ) : (
        <GroupForm initial={group ?? undefined} onSave={done} onCancel={done} />
      )}
    </AdminFormShell>
  )
}
