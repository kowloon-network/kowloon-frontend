// AdminPostEditPage -- /admin/posts/new and /admin/posts/:id/edit.

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'
import { AdminFormShell } from '../../components/admin/AdminPageHeader'
import PostForm from '../../components/admin/forms/PostForm'

export default function AdminPostEditPage() {
  const { id } = useParams()
  const isEdit = !!id
  const client = useClient()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!client || !isEdit) return
    client.admin.getPost({ postId: id })
      .then((res) => setPost(res?.post ?? null))
      .catch((err) => setError(err?.message || "Couldn't load this post."))
      .finally(() => setLoading(false))
  }, [client, id, isEdit])

  const done = () => navigate('/admin/posts')

  return (
    <AdminFormShell backTo="/admin/posts" backLabel="Posts" title={isEdit ? 'Edit Post' : 'New Post'}>
      {loading ? <Spinner centered /> : error || (isEdit && !post) ? (
        <p className="font-ui text-sm text-error">{error || 'Post not found.'}</p>
      ) : (
        <PostForm initial={post ?? undefined} onSave={done} onCancel={done} />
      )}
    </AdminFormShell>
  )
}
