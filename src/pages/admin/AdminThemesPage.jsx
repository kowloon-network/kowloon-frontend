// AdminThemesPage -- list and delete themes; set server default. Create and
// edit live on AdminThemeEditPage.

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Pencil, Star } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { useDispatch } from 'react-redux'
import { fetchThemesAsync } from '../../features/theme/themeSlice'
import Spinner from '../../components/ui/Spinner'
import { AdminListHeader } from '../../components/admin/AdminPageHeader'

// Small row of color swatches -- visual fingerprint for a theme
function ThemeSwatches({ theme }) {
  if (!theme.colors) return <span className="font-ui text-xs text-base-content/40">system</span>
  const keys = ['base-100', 'primary', 'secondary', 'accent', 'base-content']
  return (
    <div className="flex gap-0.5">
      {keys.map((k) => (
        <span
          key={k}
          title={k}
          style={{ background: theme.colors[k] ?? '#888', width: 16, height: 16, display: 'inline-block', border: '1px solid rgba(0,0,0,.15)' }}
        />
      ))}
    </div>
  )
}

export default function AdminThemesPage() {
  const client = useClient()
  const dispatch = useDispatch()
  const [themes, setThemes] = useState([])
  const [defaultId, setDefaultId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [pending, setPending] = useState(null)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      const res = await client.themes.list()
      setThemes(res?.themes ?? [])
      setDefaultId(res?.defaultThemeId ?? null)
    } catch (err) {
      if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => { load() }, [load])

  const handleSetDefault = async (id) => {
    setPending(id)
    try {
      await client.themes.setDefault(id)
      setDefaultId(id)
      dispatch(fetchThemesAsync()) // refresh global theme list
    } catch {}
    setPending(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this theme?')) return
    setPending(id)
    try {
      await client.themes.delete(id)
      setThemes((prev) => prev.filter((t) => t.id !== id))
    } catch {}
    setPending(null)
  }

  if (denied) return (
    <div className="py-16 text-center"><p className="font-display text-3xl tracking-wide">Access Denied</p></div>
  )

  const SCHEME_BADGE = {
    light: 'bg-warning/15 text-warning',
    dark: 'bg-info/15 text-info',
    system: 'bg-base-300 text-base-content/60',
  }

  return (
    <div>
      <AdminListHeader title="Themes" newTo="/admin/themes/new" newLabel="New Theme" />

      {loading ? <Spinner centered /> : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-base-300">
              {['Preview', 'Name', 'Scheme', 'Status', ''].map((h) => (
                <th key={h} className="font-ui text-xs uppercase tracking-widest text-base-content/50 text-left pb-2 pr-4 last:pr-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {themes.map((theme) => (
              <tr key={theme.id} className="border-b border-base-300 hover:bg-base-200">
                <td className="py-3 pr-4">
                  <ThemeSwatches theme={theme} />
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {theme.isBuiltIn ? (
                      <span className="font-ui text-sm font-medium">{theme.name}</span>
                    ) : (
                      <Link to={`/admin/themes/${encodeURIComponent(theme.id)}/edit`}
                        className="font-ui text-sm font-medium hover:text-primary transition-colors">
                        {theme.name}
                      </Link>
                    )}
                    {theme.isBuiltIn && (
                      <span className="font-ui text-[10px] uppercase tracking-widest px-1.5 py-0.5 bg-base-300 text-base-content/50">Built-in</span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-base-content/40">{theme.id}</span>
                  {theme.description && (
                    <p className="font-ui text-xs text-base-content/50 mt-0.5 line-clamp-1">{theme.description}</p>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span className={`font-ui text-xs uppercase tracking-widest px-2 py-0.5 ${SCHEME_BADGE[theme.colorScheme] ?? ''}`}>
                    {theme.colorScheme}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  {defaultId === theme.id ? (
                    <span className="flex items-center gap-1 font-ui text-xs uppercase tracking-widest text-primary">
                      <Star size={11} className="fill-current" /> Default
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(theme.id)}
                      disabled={pending === theme.id}
                      className="font-ui text-xs uppercase tracking-widest text-base-content/40 hover:text-primary transition-colors disabled:opacity-30 flex items-center gap-1"
                    >
                      <Star size={11} /> Set Default
                    </button>
                  )}
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  {!theme.isBuiltIn && (
                    <div className="flex items-center gap-1 justify-end">
                      <Link
                        to={`/admin/themes/${encodeURIComponent(theme.id)}/edit`}
                        className="p-1 text-base-content/40 hover:text-base-content transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </Link>
                      <button
                        onClick={() => handleDelete(theme.id)}
                        disabled={pending === theme.id}
                        className="p-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {themes.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">No themes found</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
