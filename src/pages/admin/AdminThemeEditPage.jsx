// AdminThemeEditPage -- /admin/themes/new and /admin/themes/:id/edit.

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useClient } from '../../hooks/useClient'
import { fetchThemesAsync } from '../../features/theme/themeSlice'
import Spinner from '../../components/ui/Spinner'
import { AdminFormShell } from '../../components/admin/AdminPageHeader'
import ThemeForm from '../../components/admin/forms/ThemeForm'

export default function AdminThemeEditPage() {
  const { id } = useParams()
  const isEdit = !!id
  const client = useClient()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [themes, setThemes] = useState([])
  const [theme, setTheme] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // The full list is always needed: the built-in Light/Dark themes power the
  // form's "Start From" presets (and prefill a new theme).
  useEffect(() => {
    if (!client) return
    client.themes.list()
      .then(async (res) => {
        const list = res?.themes ?? []
        setThemes(list)
        if (!isEdit) return
        const found = list.find((t) => t.id === id)
        if (found) setTheme(found)
        else setTheme((await client.themes.getById(id))?.theme ?? null)
      })
      .catch((err) => setError(err?.message || "Couldn't load this theme."))
      .finally(() => setLoading(false))
  }, [client, id, isEdit])

  const presets = {
    light: themes.find((t) => t.id === 'kowloon-light'),
    dark: themes.find((t) => t.id === 'kowloon-dark'),
  }

  const done = () => navigate('/admin/themes')

  // Errors thrown here are caught and shown by ThemeForm.
  const handleSave = async (form) => {
    if (isEdit) await client.themes.update(id, form)
    else await client.themes.create(form)
    dispatch(fetchThemesAsync()) // refresh global theme list
    done()
  }

  let body
  if (loading) body = <Spinner centered />
  else if (error || (isEdit && !theme)) body = <p className="font-ui text-sm text-error">{error || 'Theme not found.'}</p>
  else if (theme?.isBuiltIn) body = <p className="font-ui text-sm text-base-content/60">Built-in themes can't be edited.</p>
  else body = <ThemeForm initial={theme} presets={presets} onSave={handleSave} onCancel={done} />

  return (
    <AdminFormShell backTo="/admin/themes" backLabel="Themes" title={isEdit ? 'Edit Theme' : 'New Theme'}>
      {body}
    </AdminFormShell>
  )
}
