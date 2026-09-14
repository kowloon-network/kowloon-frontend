// AdminSettingsPage — tabbed, purpose-built settings editor

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { ArrowUp, ArrowDown, Trash2, Plus, Upload, X, Check, Eye, EyeOff, Loader, Download, AlertTriangle } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'
import { fetchServerInfoAsync } from '../../app/serverSlice'
import sizedUrl from '../../lib/sizedUrl'

// ── Tab config ─────────────────────────────────────────────────────────────

const VALID_TAB_IDS = new Set(['general','appearance','users','email','moderation','content','media','integrations','maintenance'])

function useHashTab(defaultTab) {
  const read = () => {
    const h = window.location.hash.slice(1)
    return VALID_TAB_IDS.has(h) ? h : defaultTab
  }
  const [tab, setTab] = useState(read)
  useEffect(() => {
    const handler = () => setTab(read())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  return tab
}

const TABS = [
  { id: 'general',      label: 'General' },
  { id: 'appearance',   label: 'Appearance' },
  { id: 'users',        label: 'Users' },
  { id: 'email',        label: 'Email' },
  { id: 'moderation',   label: 'Moderation' },
  { id: 'content',      label: 'Content' },
  { id: 'media',        label: 'Media' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'maintenance',  label: 'Maintenance' },
]

// ── Shared UI primitives ───────────────────────────────────────────────────

function FieldRow({ label, description, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 py-4 border-b border-base-300 last:border-0 ${className}`}>
      <label className="font-ui text-xs uppercase tracking-widest text-base-content/60">{label}</label>
      {children}
      {description && (
        <p className="font-ui text-xs text-base-content/40 mt-0.5">{description}</p>
      )}
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', placeholder, disabled, className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none w-full max-w-md disabled:opacity-50 ${className}`}
    />
  )
}

function NumberInput({ value, onChange, min, max, disabled, className = '' }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className={`border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none w-32 disabled:opacity-50 ${className}`}
    />
  )
}

function PasswordInput({ value, onChange, disabled }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative max-w-md">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 pr-10 font-ui text-sm outline-none w-full disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer w-fit select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative w-10 h-5 transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-base-300'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <span className={`font-ui text-sm ${checked ? 'text-base-content' : 'text-base-content/50'}`}>
        {label ?? (checked ? 'Enabled' : 'Disabled')}
      </span>
    </label>
  )
}

function JsonTextarea({ value, onChange, disabled, rows = 6 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={rows}
      className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-mono text-xs outline-none w-full max-w-2xl resize-y disabled:opacity-50"
    />
  )
}

function SaveBar({ saving, saved, error, onSave, dirty }) {
  return (
    <div className="flex items-center gap-3 pt-5">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !dirty}
        className="px-5 py-2 font-ui text-xs uppercase tracking-widest bg-primary text-primary-content hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        {saving ? 'Saving...' : 'Save changes'}
      </button>
      {saved && !error && (
        <span className="flex items-center gap-1.5 font-ui text-xs text-success uppercase tracking-widest">
          <Check size={12} /> Saved
        </span>
      )}
      {error && <span className="font-ui text-xs text-error">{error}</span>}
    </div>
  )
}

// ── HTML rich-text editor ──────────────────────────────────────────────────
// TipTap editor that reads/writes HTML (not Markdown). Used for the server
// profile description, which is stored and rendered as HTML.

function EditorToolbarButton({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={`px-4 py-2.5 font-ui text-sm uppercase tracking-widest transition-colors ${
        active
          ? 'bg-primary text-primary-content'
          : 'bg-base-200 text-base-content/70 hover:bg-base-300'
      }`}
    >
      {children}
    </button>
  )
}

function HtmlEditor({ value, onChange, disabled }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange?.(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && editor.isEditable === disabled) {
      editor.setEditable(!disabled)
    }
  }, [editor, disabled])

  if (!editor) return null

  return (
    <div className={`border-2 border-base-300 max-w-2xl ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex flex-wrap gap-0 border-b-2 border-base-300 bg-base-200">
        <EditorToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>B</EditorToolbarButton>
        <EditorToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}><em>I</em></EditorToolbarButton>
        <EditorToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}><span className="underline">U</span></EditorToolbarButton>
        <EditorToolbarButton
          onClick={() => {
            const url = window.prompt('Enter URL')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          active={editor.isActive('link')}
        >
          Link
        </EditorToolbarButton>
        {editor.isActive('link') && (
          <EditorToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} active={false}>Unlink</EditorToolbarButton>
        )}
        <EditorToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          &ldquo;&rdquo;
        </EditorToolbarButton>
        <EditorToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading">
          H2
        </EditorToolbarButton>
        <EditorToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          &bull;&mdash;
        </EditorToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className="font-reading text-base-content p-4 prose max-w-none focus:outline-none bg-base-100 min-h-32"
      />
    </div>
  )
}

function SectionHeading({ title, description }) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-2xl tracking-wide">{title}</h2>
      {description && <p className="font-ui text-sm text-base-content/50 mt-1">{description}</p>}
    </div>
  )
}

// ── Image upload ───────────────────────────────────────────────────────────

function ImageUploadField({ label, description, value, onUploaded, client }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const result = await client.files.upload({
        file, filename: file.name, contentType: file.type,
        to: '@public', generateThumbnail: true, thumbnailSizes: [200, 400],
      })
      onUploaded(result.file.url)
    } catch (err) {
      setError(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <FieldRow label={label} description={description}>
      {value && (
        <div className="relative w-fit mb-1">
          <img src={sizedUrl(value, 400)} alt="" className="max-h-28 max-w-xs object-contain border border-base-300" />
          <button type="button" onClick={() => onUploaded('')}
            className="absolute top-1 right-1 bg-base-100 border border-base-300 p-0.5 text-base-content/50 hover:text-error transition-colors">
            <X size={12} />
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 w-fit px-3 py-1.5 font-ui text-xs uppercase tracking-widest border border-base-300 hover:border-primary text-base-content/60 hover:text-base-content disabled:opacity-40 transition-colors">
        <Upload size={13} />
        {uploading ? 'Uploading...' : value ? 'Replace' : 'Upload'}
      </button>
      {error && <p className="font-ui text-xs text-error mt-1">{error}</p>}
    </FieldRow>
  )
}

// ── Circle member picker ───────────────────────────────────────────────────
// Manages membership in a server-role circle (admin or mod).
// Saves immediately on add/remove — no Save button needed.

function CircleMemberPicker({ role, client }) {
  const [members,     setMembers]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [fetchError,  setFetchError]  = useState(null)
  const [pending,     setPending]     = useState(new Set())
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState([])
  const [searching,   setSearching]   = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [opError,     setOpError]     = useState(null)

  useEffect(() => {
    if (!client) return
    setLoading(true); setFetchError(null)
    const fn = role === 'admin' ? client.admin.getAdmins() : client.admin.getMods()
    fn.then((res) => setMembers(res?.members ?? []))
      .catch((err) => setFetchError(err?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [role, client])

  const handleSearch = async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true); setSearchError(null); setResults([])
    try {
      const res = await client.feeds.http.get('/users/search', { params: { q, limit: 10 } })
      const items = res?.orderedItems ?? []
      if (!items.length) setSearchError('No users found')
      setResults(items)
    } catch (err) {
      setSearchError(err?.message || 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = async (user) => {
    if (members.some((m) => m.id === user.id)) return
    setOpError(null)
    const optimistic = { id: user.id, name: user.name, icon: user.icon }
    setMembers((prev) => [...prev, optimistic])
    setQuery(''); setResults([]); setSearchError(null)
    try {
      if (role === 'admin') await client.admin.addAdmin({ userId: user.id })
      else await client.admin.addMod({ userId: user.id })
    } catch (err) {
      setMembers((prev) => prev.filter((m) => m.id !== user.id))
      setOpError(err?.message || 'Failed to add user')
    }
  }

  const handleRemove = async (id) => {
    setOpError(null)
    const removed = members.find((m) => m.id === id)
    setPending((p) => new Set([...p, id]))
    setMembers((prev) => prev.filter((m) => m.id !== id))
    try {
      if (role === 'admin') await client.admin.removeAdmin({ userId: id })
      else await client.admin.removeMod({ userId: id })
    } catch (err) {
      setMembers((prev) => [...prev, removed])
      setOpError(err?.message || 'Failed to remove user')
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(id); return n })
    }
  }

  if (loading) return <Spinner />
  if (fetchError) return <p className="font-ui text-xs text-error">{fetchError}</p>

  return (
    <div className="flex flex-col gap-3">
      {members.length === 0 ? (
        <p className="font-ui text-xs text-base-content/40">None.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 border border-base-300 bg-base-100 px-3 py-2">
              {m.icon
                ? <img src={m.icon} alt="" className="w-7 h-7 object-cover shrink-0" />
                : <div className="w-7 h-7 bg-base-300 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                {m.name && <p className="font-ui text-sm truncate">{m.name}</p>}
                <p className="font-mono text-xs text-base-content/50 truncate">{m.id}</p>
              </div>
              <button type="button" onClick={() => handleRemove(m.id)} disabled={pending.has(m.id)}
                className="p-1 text-base-content/30 hover:text-error disabled:opacity-20 transition-colors">
                {pending.has(m.id) ? <Loader size={13} className="animate-spin" /> : <X size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input type="text" value={query}
          onChange={(e) => { setQuery(e.target.value); setResults([]); setSearchError(null) }}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          placeholder="Search by name or @handle"
          className="flex-1 max-w-sm border border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none"
        />
        <button type="button" onClick={handleSearch} disabled={!query.trim() || searching}
          className="px-4 py-2 font-ui text-xs uppercase tracking-widest border border-base-300 hover:border-primary text-base-content/60 hover:text-base-content disabled:opacity-40 transition-colors">
          {searching ? <Loader size={14} className="animate-spin" /> : 'Search'}
        </button>
      </div>

      {searchError && <p className="font-ui text-xs text-error">{searchError}</p>}
      {opError    && <p className="font-ui text-xs text-error">{opError}</p>}

      {results.length > 0 && (
        <ul className="flex flex-col border border-base-300 max-w-sm">
          {results.map((user) => {
            const already = members.some((m) => m.id === user.id)
            return (
              <li key={user.id} className="flex items-center gap-3 border-b border-base-300 last:border-b-0 bg-base-100 hover:bg-base-200 transition-colors">
                <button type="button" onClick={() => handleAdd(user)} disabled={already}
                  className="flex items-center gap-3 px-3 py-2 flex-1 min-w-0 text-left disabled:opacity-40">
                  {user.icon
                    ? <img src={user.icon} alt="" className="w-7 h-7 object-cover shrink-0" />
                    : <div className="w-7 h-7 bg-base-300 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-ui text-sm truncate">{user.name}</p>
                    <p className="font-mono text-xs text-base-content/50 truncate">{user.id}</p>
                  </div>
                  {!already && (
                    <span className="shrink-0 font-ui text-xs uppercase tracking-widest text-primary">Add</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Rules editor ───────────────────────────────────────────────────────────

function RulesEditor({ setting, client, onSaved }) {
  const initial = Array.isArray(setting?.value)
    ? setting.value.map((r) => ({ id: r.id, text: r.text ?? '' }))
    : []
  const [rules, setRules] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const dirty = JSON.stringify(rules) !== JSON.stringify(initial)

  const update = (i, text) => setRules((p) => p.map((r, idx) => idx === i ? { ...r, text } : r))
  const move = (i, d) => setRules((p) => {
    const j = i + d
    if (j < 0 || j >= p.length) return p
    const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n
  })
  const remove = (i) => setRules((p) => p.filter((_, idx) => idx !== i))
  const add = () => setRules((p) => [
    ...p,
    { id: globalThis.crypto?.randomUUID?.() ?? `new-${Math.random()}`, text: '' },
  ])

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const payload = rules
        .map((r) => ({ id: r.id, text: (r.text || '').trim() }))
        .filter((r) => r.text)
      await client.admin.updateSetting({ settingId: setting.name, value: payload })
      onSaved(setting.name, payload)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {rules.length === 0 && (
        <p className="font-ui text-xs text-base-content/40 uppercase tracking-widest">
          No rules — users won't see an acknowledgement step at registration.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {rules.map((rule, i) => (
          <li key={rule.id} className="flex items-start gap-2 border border-base-300 bg-base-100 p-2">
            <span className="font-ui text-xs text-base-content/40 mt-2 w-5 text-right tabular-nums shrink-0">{i + 1}</span>
            <textarea value={rule.text} onChange={(e) => update(i, e.target.value)}
              placeholder="Markdown supported" rows={2} disabled={saving}
              className="flex-1 bg-base-100 border border-base-300 focus:border-primary outline-none px-2 py-1 font-reading text-sm resize-y" />
            <div className="flex flex-col gap-0.5 shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={saving || i === 0}
                className="p-1 text-base-content/40 hover:text-base-content disabled:opacity-20"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={saving || i === rules.length - 1}
                className="p-1 text-base-content/40 hover:text-base-content disabled:opacity-20"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => remove(i)} disabled={saving}
                className="p-1 text-base-content/40 hover:text-error disabled:opacity-20"><Trash2 size={14} /></button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={add} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 font-ui text-xs uppercase tracking-widest border border-base-300 hover:border-primary text-base-content/60 hover:text-base-content disabled:opacity-40 transition-colors">
          <Plus size={13} /> Add rule
        </button>
        <SaveBar saving={saving} saved={saved} error={error} onSave={save} dirty={dirty} />
      </div>
    </div>
  )
}

// ── Emoji editor ───────────────────────────────────────────────────────────

function EmojiEditor({ setting, client, onSaved }) {
  const initial = Array.isArray(setting?.value) ? setting.value : []
  const [emojis, setEmojis] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [newEmoji, setNewEmoji] = useState('')
  const [newName, setNewName] = useState('')

  const dirty = JSON.stringify(emojis) !== JSON.stringify(initial)

  const move = (i, d) => setEmojis((p) => {
    const j = i + d
    if (j < 0 || j >= p.length) return p
    const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n
  })
  const remove = (i) => setEmojis((p) => p.filter((_, idx) => idx !== i))
  const addEmoji = () => {
    if (!newEmoji.trim() || !newName.trim()) return
    setEmojis((p) => [...p, { emoji: newEmoji.trim(), name: newName.trim() }])
    setNewEmoji(''); setNewName('')
  }

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await client.admin.updateSetting({ settingId: setting.name, value: emojis })
      onSaved(setting.name, emojis)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {emojis.map((e, i) => (
          <li key={i} className="flex items-center gap-3 border border-base-300 bg-base-100 px-3 py-2">
            <span className="text-xl w-8 text-center">{e.emoji}</span>
            <span className="font-ui text-sm flex-1">{e.name}</span>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => move(i, -1)} disabled={saving || i === 0}
                className="p-1 text-base-content/30 hover:text-base-content disabled:opacity-20"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={saving || i === emojis.length - 1}
                className="p-1 text-base-content/30 hover:text-base-content disabled:opacity-20"><ArrowDown size={12} /></button>
              <button type="button" onClick={() => remove(i)} disabled={saving}
                className="p-1 text-base-content/30 hover:text-error disabled:opacity-20"><Trash2 size={12} /></button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input type="text" value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)}
          placeholder="😀" maxLength={8}
          className="border border-base-300 focus:border-primary bg-base-100 px-2 py-1.5 text-center text-xl w-14 outline-none" />
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="Reaction name" onKeyDown={(e) => e.key === 'Enter' && addEmoji()}
          className="border border-base-300 focus:border-primary bg-base-100 px-3 py-1.5 font-ui text-sm outline-none w-48" />
        <button type="button" onClick={addEmoji} disabled={!newEmoji.trim() || !newName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 font-ui text-xs uppercase tracking-widest border border-base-300 hover:border-primary text-base-content/60 hover:text-base-content disabled:opacity-40 transition-colors">
          <Plus size={13} /> Add
        </button>
      </div>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} dirty={dirty} />
    </div>
  )
}

// ── Blocked domains editor ─────────────────────────────────────────────────

function BlockedDomainsEditor({ setting, client, onSaved }) {
  const toEntries = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}
  const initial = toEntries(setting?.value)
  const [blocked, setBlocked] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [newDomain, setNewDomain] = useState('')
  const [newReason, setNewReason] = useState('')

  const dirty = JSON.stringify(blocked) !== JSON.stringify(initial)
  const entries = Object.entries(blocked)

  const addDomain = () => {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '')
    if (!d) return
    setBlocked((p) => ({ ...p, [d]: newReason.trim() }))
    setNewDomain(''); setNewReason('')
  }
  const removeDomain = (domain) => setBlocked((p) => {
    const n = { ...p }; delete n[domain]; return n
  })

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await client.admin.updateSetting({ settingId: setting.name, value: blocked })
      onSaved(setting.name, blocked)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 && (
        <p className="font-ui text-xs text-base-content/40 uppercase tracking-widest">No domains blocked.</p>
      )}
      <ul className="flex flex-col gap-1">
        {entries.map(([domain, reason]) => (
          <li key={domain} className="flex items-center gap-3 border border-base-300 bg-base-100 px-3 py-2">
            <span className="font-mono text-sm flex-1">{domain}</span>
            {reason && <span className="font-ui text-xs text-base-content/50 flex-1 truncate">{reason}</span>}
            <button type="button" onClick={() => removeDomain(domain)} disabled={saving}
              className="p-1 text-base-content/30 hover:text-error disabled:opacity-20"><X size={14} /></button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 flex-wrap">
        <input type="text" value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
          placeholder="example.com" onKeyDown={(e) => e.key === 'Enter' && addDomain()}
          className="border border-base-300 focus:border-primary bg-base-100 px-3 py-1.5 font-mono text-sm outline-none w-44" />
        <input type="text" value={newReason} onChange={(e) => setNewReason(e.target.value)}
          placeholder="Reason (optional)" onKeyDown={(e) => e.key === 'Enter' && addDomain()}
          className="border border-base-300 focus:border-primary bg-base-100 px-3 py-1.5 font-ui text-sm outline-none w-64" />
        <button type="button" onClick={addDomain} disabled={!newDomain.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 font-ui text-xs uppercase tracking-widest border border-base-300 hover:border-primary text-base-content/60 hover:text-base-content disabled:opacity-40 transition-colors">
          <Plus size={13} /> Block
        </button>
      </div>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} dirty={dirty} />
    </div>
  )
}

// ── Tab sections ───────────────────────────────────────────────────────────

function GeneralSection({ settings, client, onSaved }) {
  const get = (name) => settings.find((s) => s.name === name)
  const domainSetting = get('domain')
  const emailSetting  = get('adminEmail')

  const [domain,     setDomain]     = useState(domainSetting?.value ?? '')
  const [adminEmail, setAdminEmail] = useState(emailSetting?.value  ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState(null)

  const dirty = domain !== (domainSetting?.value ?? '') || adminEmail !== (emailSetting?.value ?? '')

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await Promise.all([
        client.admin.updateSetting({ settingId: 'domain',     value: domain }),
        client.admin.updateSetting({ settingId: 'adminEmail', value: adminEmail }),
      ])
      onSaved('domain',     domain)
      onSaved('adminEmail', adminEmail)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeading title="General" description="Core server identity." />
      <FieldRow label="Domain" description="Fully-qualified domain name. Changing this after setup can break federation.">
        <TextInput value={domain} onChange={(v) => { setDomain(v); setSaved(false) }} disabled={saving} />
      </FieldRow>
      <FieldRow label="Admin email" description="Used for Let's Encrypt certificate warnings and server-level notifications.">
        <TextInput type="email" value={adminEmail} onChange={(v) => { setAdminEmail(v); setSaved(false) }} disabled={saving} />
      </FieldRow>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} dirty={dirty} />

      <div className="mt-10 pt-8 border-t-2 border-base-300">
        <h3 className="font-display text-xl tracking-wide mb-1">Administrators</h3>
        <p className="font-ui text-sm text-base-content/50 mb-4">
          Members of the admin circle have full access to this settings panel and all admin tools.
          Changes take effect immediately.
        </p>
        <CircleMemberPicker role="admin" client={client} />
      </div>

      <div className="mt-8 pt-8 border-t-2 border-base-300">
        <h3 className="font-display text-xl tracking-wide mb-1">Moderators</h3>
        <p className="font-ui text-sm text-base-content/50 mb-4">
          Members of the mod circle can review flagged content and take moderation actions.
          Changes take effect immediately.
        </p>
        <CircleMemberPicker role="mod" client={client} />
      </div>
    </div>
  )
}

function AppearanceSection({ settings, client, onSaved }) {
  const dispatch = useDispatch()
  const get = (name) => settings.find((s) => s.name === name)
  const profileSetting = get('profile')
  const emojiSetting   = get('reactEmojis')

  const initial = profileSetting?.value ?? {}
  const [form, setForm] = useState({
    name:         initial.name         ?? '',
    subtitle:     initial.subtitle     ?? '',
    description:  initial.description  ?? '',
    locationName: initial.location?.name ?? '',
    icon:         initial.icon         ?? '',
    image:        initial.image        ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const initialForm = {
    name: initial.name ?? '', subtitle: initial.subtitle ?? '',
    description: initial.description ?? '', locationName: initial.location?.name ?? '',
    icon: initial.icon ?? '', image: initial.image ?? '',
  }
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false) }

  const saveProfile = async (snapshot) => {
    const s = snapshot ?? form
    setSaving(true); setError(null); setSaved(false)
    try {
      const value = {
        ...initial,
        name: s.name, subtitle: s.subtitle, description: s.description,
        icon: s.icon, image: s.image,
        location: { ...(initial.location ?? {}), name: s.locationName },
      }
      await client.admin.updateSetting({ settingId: 'profile', value })
      onSaved('profile', value)
      dispatch(fetchServerInfoAsync())
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUploaded = (field, url) => {
    const next = { ...form, [field]: url }
    setForm(next)
    setSaved(false)
    saveProfile(next)
  }

  return (
    <div>
      <SectionHeading title="Appearance" description="How your server presents itself to the world." />
      <FieldRow label="Server name" description="Shown in the header and in federation metadata.">
        <TextInput value={form.name} onChange={(v) => set('name', v)} disabled={saving} />
      </FieldRow>
      <FieldRow label="Subtitle" description="Short tagline shown under the server name.">
        <TextInput value={form.subtitle} onChange={(v) => set('subtitle', v)} disabled={saving} />
      </FieldRow>
      <ImageUploadField
        label="Server icon" client={client} value={form.icon}
        description="Used in the header and federation previews. Recommended: square, at least 200x200px."
        onUploaded={(url) => handleImageUploaded('icon', url)}
      />
      <ImageUploadField
        label="Hero image" client={client} value={form.image}
        description="Banner shown in the sidebar. Recommended: 1200x400px or wider."
        onUploaded={(url) => handleImageUploaded('image', url)}
      />
      <FieldRow label="Description" description="Public-facing server description, shown on the homepage.">
        <HtmlEditor value={form.description} onChange={(v) => set('description', v)} disabled={saving} />
      </FieldRow>
      <FieldRow label="Location" description="Optional location name shown in the server profile.">
        <TextInput value={form.locationName} onChange={(v) => set('locationName', v)} disabled={saving} />
      </FieldRow>
      <SaveBar saving={saving} saved={saved} error={error} onSave={() => saveProfile()} dirty={dirty} />

      {emojiSetting && (
        <div className="mt-10 pt-8 border-t-2 border-base-300">
          <h3 className="font-display text-xl tracking-wide mb-1">Reaction emojis</h3>
          <p className="font-ui text-sm text-base-content/50 mb-4">
            Reactions users can apply to posts.
          </p>
          <EmojiEditor setting={emojiSetting} client={client} onSaved={onSaved} />
        </div>
      )}
    </div>
  )
}

// Registration itself has no setting to control anymore — every server
// requires an invite (individual, or an admin-issued "open" link, which can
// be unlimited-redemption for low-friction signup). Manage that under
// Invites, not here. This tab is left for the one other per-user default
// that lived alongside it for UI-organization reasons, not a shared group.
function UsersSection({ settings, client, onSaved }) {
  const get = (name) => settings.find((s) => s.name === name)
  const pronounsSetting = get('defaultPronouns')

  const [pronouns, setPronouns] = useState({
    subject:   pronounsSetting?.value?.subject   ?? 'they',
    object:    pronounsSetting?.value?.object    ?? 'them',
    possAdj:   pronounsSetting?.value?.possAdj   ?? 'their',
    possPro:   pronounsSetting?.value?.possPro   ?? 'theirs',
    reflexive: pronounsSetting?.value?.reflexive ?? 'themselves',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const initialPronouns = { ...pronounsSetting?.value }
  const dirty = JSON.stringify(pronouns) !== JSON.stringify(initialPronouns)

  const setP = (k, v) => { setPronouns((p) => ({ ...p, [k]: v })); setSaved(false) }

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await client.admin.updateSetting({ settingId: 'defaultPronouns', value: pronouns })
      onSaved('defaultPronouns', pronouns)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const PRONOUN_FIELDS = [
    { key: 'subject',   label: 'Subject',              placeholder: 'they' },
    { key: 'object',    label: 'Object',               placeholder: 'them' },
    { key: 'possAdj',  label: 'Possessive adjective',  placeholder: 'their' },
    { key: 'possPro',  label: 'Possessive pronoun',    placeholder: 'theirs' },
    { key: 'reflexive', label: 'Reflexive',            placeholder: 'themselves' },
  ]

  return (
    <div>
      <SectionHeading title="Users" description="Defaults new accounts start with. To control who can sign up, use Invites." />
      <div>
        <h3 className="font-display text-xl tracking-wide mb-1">Default pronouns</h3>
        <p className="font-ui text-sm text-base-content/50 mb-4">Pre-filled in new user profiles. Users can change them at any time.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-0">
          {PRONOUN_FIELDS.map(({ key, label, placeholder }) => (
            <FieldRow key={key} label={label} className="last:border-0">
              <TextInput
                value={pronouns[key] ?? ''}
                onChange={(v) => setP(key, v)}
                placeholder={placeholder}
                disabled={saving}
                className="max-w-xs"
              />
            </FieldRow>
          ))}
        </div>
      </div>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} dirty={dirty} />
    </div>
  )
}

function EmailSection({ settings, client, onSaved }) {
  const get = (name) => settings.find((s) => s.name === name)
  const smtpSetting     = get('emailServer')
  const verifSetting    = get('requireEmailVerification')

  const initialSmtp = smtpSetting?.value ?? {}
  const [form, setForm] = useState({
    host:     initialSmtp.host     ?? '',
    port:     initialSmtp.port     ?? 587,
    username: initialSmtp.username ?? '',
    password: initialSmtp.password ?? '',
    from:     initialSmtp.from     ?? '',
  })
  const [requireVerif, setRequireVerif] = useState(Boolean(verifSetting?.value))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const initialForm = {
    host: initialSmtp.host ?? '', port: initialSmtp.port ?? 587,
    username: initialSmtp.username ?? '', password: initialSmtp.password ?? '',
    from: initialSmtp.from ?? '',
  }
  const initialVerif = Boolean(verifSetting?.value)
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm) || requireVerif !== initialVerif

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false) }

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const emailValue = { ...initialSmtp, host: form.host, port: Number(form.port), username: form.username, password: form.password, from: form.from }
      await client.admin.updateSetting({ settingId: 'emailServer', value: emailValue })
      onSaved('emailServer', emailValue)
      await client.admin.updateSetting({ settingId: 'requireEmailVerification', value: requireVerif })
      onSaved('requireEmailVerification', requireVerif)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeading title="Email" description="Outbound email for notifications, password resets, and invite links." />
      <FieldRow label="SMTP host">
        <TextInput value={form.host} onChange={(v) => set('host', v)} placeholder="smtp.example.com" disabled={saving} />
      </FieldRow>
      <FieldRow label="SMTP port">
        <NumberInput value={form.port} onChange={(v) => set('port', v)} min={1} max={65535} disabled={saving} />
      </FieldRow>
      <FieldRow label="Username">
        <TextInput value={form.username} onChange={(v) => set('username', v)} disabled={saving} />
      </FieldRow>
      <FieldRow label="Password">
        <PasswordInput value={form.password} onChange={(v) => set('password', v)} disabled={saving} />
      </FieldRow>
      <FieldRow label="From address"
        description="Leave blank to send from the Username above (always deliverable, since it's the address your SMTP provider actually authenticates as). Only set this to something else if that address is also authorized to send through this account -- otherwise mail lands in spam.">
        <TextInput value={form.from} onChange={(v) => set('from', v)} placeholder={form.username || 'noreply@example.com'} disabled={saving} />
      </FieldRow>
      <FieldRow label="Require email verification"
        description="New accounts must verify their email before logging in. Requires working SMTP above.">
        <Toggle checked={requireVerif} onChange={(v) => { setRequireVerif(v); setSaved(false) }} disabled={saving}
          label={requireVerif ? 'Required' : 'Not required'} />
      </FieldRow>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} dirty={dirty} />
    </div>
  )
}

// ── Flag options editor ────────────────────────────────────────────────────

function FlagOptionsEditor({ setting, client, onSaved }) {
  const newKey = () => globalThis.crypto?.randomUUID?.() ?? `new-${Math.random()}`

  const toItems = (val) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return []
    return Object.entries(val).map(([slug, v]) => ({
      _key: newKey(),
      _slugManual: true,
      slug,
      label:       v?.label       ?? '',
      description: v?.description ?? '',
    }))
  }

  const toValue = (items) =>
    Object.fromEntries(
      items
        .filter((i) => i.slug.trim())
        .map(({ slug, label, description }) => [slug.trim(), { label: label.trim(), description: description.trim() }])
    )

  const initial = toItems(setting?.value)
  const [items,  setItems]  = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState(null)

  const dirty = JSON.stringify(toValue(items)) !== JSON.stringify(setting?.value ?? {})

  const update = (key, field, val) => setItems((p) => p.map((i) => {
    if (i._key !== key) return i
    const next = { ...i, [field]: val }
    if (field === 'label' && !i._slugManual) {
      next.slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    }
    if (field === 'slug') next._slugManual = true
    return next
  }))

  const move = (key, d) => setItems((p) => {
    const idx = p.findIndex((i) => i._key === key)
    const j = idx + d
    if (j < 0 || j >= p.length) return p
    const n = [...p]; [n[idx], n[j]] = [n[j], n[idx]]; return n
  })

  const remove = (key) => setItems((p) => p.filter((i) => i._key !== key))

  const add = () => setItems((p) => [
    ...p,
    { _key: newKey(), _slugManual: false, slug: '', label: '', description: '' },
  ])

  const save = async () => {
    const slugs = items.map((i) => i.slug.trim())
    const empty = slugs.some((s) => !s)
    if (empty) { setError('All categories need a slug'); return }
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
    if (dupes.length) { setError(`Duplicate slugs: ${dupes.join(', ')}`); return }

    setSaving(true); setError(null); setSaved(false)
    try {
      const value = toValue(items)
      await client.admin.updateSetting({ settingId: setting.name, value })
      onSaved(setting.name, value)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && (
        <p className="font-ui text-xs text-base-content/40 uppercase tracking-widest">No categories defined.</p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item, i) => (
          <li key={item._key} className="border border-base-300 bg-base-100 p-3 flex flex-col gap-2">
            {/* Slug + Label row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-ui text-xs uppercase tracking-widest text-base-content/40 w-10 text-right">{i + 1}</span>
                <input
                  type="text"
                  value={item.slug}
                  onChange={(e) => update(item._key, 'slug', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="slug"
                  disabled={saving}
                  title="Internal ID — lowercase letters, numbers, underscores only"
                  className="border border-base-300 focus:border-primary bg-base-200 px-2 py-1 font-mono text-xs outline-none w-32 disabled:opacity-50"
                />
              </div>
              <input
                type="text"
                value={item.label}
                onChange={(e) => update(item._key, 'label', e.target.value)}
                placeholder="Display name"
                disabled={saving}
                className="border border-base-300 focus:border-primary bg-base-100 px-2 py-1 font-ui text-sm outline-none flex-1 min-w-32 disabled:opacity-50"
              />
              <div className="flex gap-0.5 shrink-0">
                <button type="button" onClick={() => move(item._key, -1)} disabled={saving || i === 0}
                  className="p-1 text-base-content/40 hover:text-base-content disabled:opacity-20"><ArrowUp size={14} /></button>
                <button type="button" onClick={() => move(item._key, 1)} disabled={saving || i === items.length - 1}
                  className="p-1 text-base-content/40 hover:text-base-content disabled:opacity-20"><ArrowDown size={14} /></button>
                <button type="button" onClick={() => remove(item._key)} disabled={saving}
                  className="p-1 text-base-content/40 hover:text-error disabled:opacity-20"><Trash2 size={14} /></button>
              </div>
            </div>
            {/* Description */}
            <textarea
              value={item.description}
              onChange={(e) => update(item._key, 'description', e.target.value)}
              placeholder="Description shown to users when they select this category"
              rows={2}
              disabled={saving}
              className="border border-base-300 focus:border-primary bg-base-100 px-2 py-1.5 font-reading text-sm outline-none w-full resize-y disabled:opacity-50"
            />
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={add} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 font-ui text-xs uppercase tracking-widest border border-base-300 hover:border-primary text-base-content/60 hover:text-base-content disabled:opacity-40 transition-colors">
          <Plus size={13} /> Add category
        </button>
        <SaveBar saving={saving} saved={saved} error={error} onSave={save} dirty={dirty} />
      </div>
    </div>
  )
}

function ModerationSection({ settings, client, onSaved }) {
  const get = (name) => settings.find((s) => s.name === name)
  const rulesSetting   = get('rules')
  const blockedSetting = get('blocked')
  const flagSetting    = get('flagOptions')

  return (
    <div>
      <SectionHeading title="Moderation" description="Community rules, blocked servers, and report categories." />

      {rulesSetting && (
        <div className="mb-10">
          <h3 className="font-display text-xl tracking-wide mb-1">Community rules</h3>
          <p className="font-ui text-sm text-base-content/50 mb-4">
            Shown to new users at registration and on the public /rules page. Markdown supported.
          </p>
          <RulesEditor setting={rulesSetting} client={client} onSaved={onSaved} />
        </div>
      )}

      {blockedSetting && (
        <div className="py-8 border-t-2 border-base-300 mb-10">
          <h3 className="font-display text-xl tracking-wide mb-1">Blocked domains</h3>
          <p className="font-ui text-sm text-base-content/50 mb-4">
            Content from these servers won't be delivered to your users.
          </p>
          <BlockedDomainsEditor setting={blockedSetting} client={client} onSaved={onSaved} />
        </div>
      )}

      {flagSetting && (
        <div className="py-8 border-t-2 border-base-300">
          <h3 className="font-display text-xl tracking-wide mb-1">Report categories</h3>
          <p className="font-ui text-sm text-base-content/50 mb-4">
            Categories shown to users when flagging content for review.
          </p>
          <FlagOptionsEditor setting={flagSetting} client={client} onSaved={onSaved} />
        </div>
      )}
    </div>
  )
}

function ContentSection({ settings, client, onSaved }) {
  const setting = settings.find((s) => s.name === 'maxUploadSize')
  const [maxUpload, setMaxUpload] = useState(setting?.value ?? 100)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const dirty = maxUpload !== (setting?.value ?? 100)

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await client.admin.updateSetting({ settingId: 'maxUploadSize', value: maxUpload })
      onSaved('maxUploadSize', maxUpload)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeading title="Content" description="Upload limits and content handling." />
      <FieldRow label="Max upload size" description="Maximum file size users can upload. Applies to images, video, and other attachments.">
        <div className="flex items-center gap-3">
          <NumberInput value={maxUpload} onChange={(v) => { setMaxUpload(v); setSaved(false) }} min={1} max={2048} disabled={saving} />
          <span className="font-ui text-sm text-base-content/50">MB</span>
        </div>
      </FieldRow>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} dirty={dirty} />
    </div>
  )
}

function MediaSection({ settings, client, onSaved }) {
  const get = (name) => settings.find((s) => s.name === name)
  const processorSetting  = get('mediaProcessor')
  const urlSetting        = get('mediaProcessorUrl')
  const secretSetting     = get('mediaProcessorSecret')

  const [processor, setProcessor] = useState(processorSetting?.value ?? 'local')
  const [url,       setUrl]       = useState(urlSetting?.value ?? '')
  const [secret,    setSecret]    = useState(secretSetting?.value ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [error,     setError]     = useState(null)

  const dirty =
    processor !== (processorSetting?.value ?? 'local') ||
    url       !== (urlSetting?.value ?? '') ||
    secret    !== (secretSetting?.value ?? '')

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await Promise.all([
        client.admin.updateSetting({ settingId: 'mediaProcessor', value: processor }),
        client.admin.updateSetting({ settingId: 'mediaProcessorUrl', value: url }),
        ...(secret ? [client.admin.updateSetting({ settingId: 'mediaProcessorSecret', value: secret })] : []),
      ])
      onSaved('mediaProcessor', processor)
      onSaved('mediaProcessorUrl', url)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeading title="Media" description="How uploaded images and videos are processed." />

      <div className="flex flex-col gap-6 max-w-xl">
        <FieldRow label="Processor" hint="Local uses Sharp + FFmpeg on this server. Remote forwards to a dedicated processor you control.">
          <select
            value={processor}
            onChange={(e) => { setProcessor(e.target.value); setSaved(false) }}
            disabled={saving}
            className="w-full px-0 py-2 bg-transparent border-b-2 border-base-300 focus:border-primary outline-none font-ui text-sm text-base-content disabled:opacity-50"
          >
            <option value="local">Local (Sharp + FFmpeg)</option>
            <option value="remote">Remote processor</option>
          </select>
        </FieldRow>

        {processor === 'remote' && (
          <>
            <FieldRow label="Processor URL" hint="HTTPS endpoint that accepts media processing jobs.">
              <TextInput value={url} onChange={(v) => { setUrl(v); setSaved(false) }}
                placeholder="https://media.example.com" disabled={saving} type="url" />
            </FieldRow>
            <FieldRow label="Processor Secret" hint="Shared secret sent in the Authorization header.">
              <PasswordInput value={secret} onChange={(e) => { setSecret(e.target.value); setSaved(false) }}
                placeholder="Leave blank to keep existing secret" disabled={saving} />
            </FieldRow>
          </>
        )}

        <SaveBar saving={saving} saved={saved} error={error} onSave={save} dirty={dirty} />
      </div>
    </div>
  )
}

function IntegrationsSection({ settings, client, onSaved }) {
  const setting = settings.find((s) => s.name === 'geocodingUrl')
  const [url, setUrl] = useState(setting?.value ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const dirty = url !== (setting?.value ?? '')

  const save = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await client.admin.updateSetting({ settingId: 'geocodingUrl', value: url })
      onSaved('geocodingUrl', url)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeading title="Integrations" description="Third-party service connections." />
      <FieldRow label="Geocoding service URL"
        description="Forward geocoding for the post composer location field. Must be Nominatim-compatible. Defaults to the public OpenStreetMap Nominatim instance.">
        <TextInput type="url" value={url} onChange={(v) => { setUrl(v); setSaved(false) }} disabled={saving} />
      </FieldRow>
      <SaveBar saving={saving} saved={saved} error={error} onSave={save} dirty={dirty} />
    </div>
  )
}

// ── Backup job status display ──────────────────────────────────────────────

function jobStatusColor(status) {
  if (status === 'done')    return 'text-success'
  if (status === 'failed')  return 'text-error'
  if (status === 'running') return 'text-warning'
  return 'text-base-content/40'
}

function jobStatusLabel(job) {
  if (job.status === 'done')    return 'Done'
  if (job.status === 'failed')  return `Failed: ${job.error || 'unknown error'}`
  if (job.status === 'running') return `${job.progress?.stage || 'Running'} (${job.progress?.pct ?? 0}%)`
  return 'Queued'
}

function BackupJobRow({ job, client, onDelete }) {
  const [deleting,     setDeleting]     = useState(false)
  const [downloading,  setDownloading]  = useState(false)
  const [downloadErr,  setDownloadErr]  = useState(null)

  const handleDownload = async () => {
    setDownloading(true); setDownloadErr(null)
    try {
      const token = await client.http.getToken()
      const base  = (client.http.baseUrl || '').replace(/\/$/, '')
      const url   = `${base}/admin/backup/${encodeURIComponent(job._id)}/download`

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!res.ok) throw new Error(`Server returned ${res.status}`)

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = job.archiveName || `kowloon-backup-${job._id}.tar.gz`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      setDownloadErr(err?.message || 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this backup? The archive will be permanently removed.')) return
    setDeleting(true)
    try {
      await client.admin.deleteBackup(job._id)
      onDelete(job._id)
    } catch { /* ignore */ } finally {
      setDeleting(false)
    }
  }

  const createdAt = job.createdAt ? new Date(job.createdAt).toLocaleString() : ''
  const isActive = job.status === 'pending' || job.status === 'running'

  return (
    <li className="flex items-center gap-3 border border-base-300 bg-base-100 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="font-ui text-xs uppercase tracking-widest text-base-content/50">{job.type} &mdash; {createdAt}</p>
        {job.archiveName && job.status === 'done' && (
          <p className="font-mono text-xs text-base-content/40 truncate mt-0.5">{job.archiveName}</p>
        )}
        <p className={`font-ui text-xs uppercase tracking-widest mt-0.5 ${jobStatusColor(job.status)}`}>
          {jobStatusLabel(job)}
        </p>
        {job.status === 'running' && (
          <div className="mt-1.5 flex flex-col gap-1">
            <div className="w-48 h-1 bg-base-300 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${job.progress?.pct ?? 0}%` }}
              />
            </div>
            {job.progress?.stage && (
              <p className="font-mono text-xs text-base-content/40">{job.progress.stage}…</p>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {downloadErr && (
          <span className="font-ui text-xs text-error mr-1">{downloadErr}</span>
        )}
        {job.status === 'done' && job.type === 'backup' && (
          <button type="button" onClick={handleDownload} disabled={downloading} title="Download archive"
            className="p-1.5 text-base-content/40 hover:text-primary disabled:opacity-20 transition-colors">
            {downloading ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
          </button>
        )}
        {!isActive && (
          <button type="button" onClick={handleDelete} disabled={deleting} title="Delete"
            className="p-1.5 text-base-content/30 hover:text-error disabled:opacity-20 transition-colors">
            {deleting ? <Loader size={14} className="animate-spin" /> : <X size={14} />}
          </button>
        )}
      </div>
    </li>
  )
}

function BackupSection({ client }) {
  const [jobs,           setJobs]           = useState([])
  const [loadingJobs,    setLoadingJobs]     = useState(true)
  const [creating,       setCreating]        = useState(false)
  const [createError,    setCreateError]     = useState(null)
  const [restoreFile,    setRestoreFile]     = useState(null)
  const [restoring,      setRestoring]       = useState(false)
  const [restoreError,   setRestoreError]    = useState(null)
  const [restoreConfirm, setRestoreConfirm]  = useState(false)
  const restoreInputRef = useRef(null)
  const pollRef         = useRef(null)

  const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running')

  const loadJobs = useCallback(async () => {
    if (!client) return
    try {
      const res = await client.admin.listBackups()
      setJobs(res?.jobs ?? [])
    } catch { /* ignore */ } finally {
      setLoadingJobs(false)
    }
  }, [client])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // Poll for updates while a job is active
  useEffect(() => {
    if (hasActive) {
      pollRef.current = setInterval(loadJobs, 3000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [hasActive, loadJobs])

  const handleCreate = async () => {
    setCreating(true); setCreateError(null)
    try {
      const res = await client.admin.createBackup()
      setJobs((prev) => [res.job, ...prev])
    } catch (err) {
      setCreateError(err?.message || 'Failed to start backup')
    } finally {
      setCreating(false)
    }
  }

  const handleFileChange = (e) => {
    setRestoreFile(e.target.files?.[0] || null)
    setRestoreConfirm(false)
    setRestoreError(null)
  }

  const handleRestore = async () => {
    if (!restoreFile || !restoreConfirm) return
    setRestoring(true); setRestoreError(null)
    try {
      const res = await client.admin.restoreFromFile(restoreFile)
      setJobs((prev) => [res.job, ...prev])
      setRestoreFile(null)
      setRestoreConfirm(false)
      if (restoreInputRef.current) restoreInputRef.current.value = ''
    } catch (err) {
      setRestoreError(err?.message || 'Failed to start restore')
    } finally {
      setRestoring(false)
    }
  }

  const handleDeleteJob = (id) => setJobs((prev) => prev.filter((j) => j._id !== id))

  return (
    <div className="flex flex-col gap-8">

      {/* Create backup */}
      <div>
        <h3 className="font-display text-xl tracking-wide mb-1">Create backup</h3>
        <p className="font-ui text-sm text-base-content/50 mb-4">
          Exports the full database and all uploaded files as a <code>.tar.gz</code> archive stored in MinIO.
          When complete you'll receive an email with a download link valid for 48 hours.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <button type="button" onClick={handleCreate} disabled={creating || hasActive}
            className="flex items-center gap-2 px-5 py-2 font-ui text-xs uppercase tracking-widest bg-secondary text-secondary-content hover:opacity-90 disabled:opacity-40 transition-opacity">
            {creating ? <Loader size={13} className="animate-spin" /> : <Download size={13} />}
            {creating ? 'Starting...' : 'Create backup'}
          </button>
          {createError && <span className="font-ui text-xs text-error">{createError}</span>}
          {hasActive && !creating && (
            <span className="font-ui text-xs text-warning uppercase tracking-widest">Job in progress...</span>
          )}
        </div>
      </div>

      {/* Job list */}
      {loadingJobs ? (
        <Spinner />
      ) : jobs.length > 0 ? (
        <div>
          <h4 className="font-ui text-xs uppercase tracking-widest text-base-content/50 mb-2">Recent jobs</h4>
          <ul className="flex flex-col gap-1">
            {jobs.map((job) => (
              <BackupJobRow key={job._id} job={job} client={client} onDelete={handleDeleteJob} />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Restore */}
      <div className="pt-6 border-t-2 border-base-300">
        <h3 className="font-display text-xl tracking-wide mb-1">Restore from backup</h3>
        <p className="font-ui text-sm text-base-content/50 mb-4">
          Upload a <code>.tar.gz</code> archive created by this server. The database and files will
          be replaced asynchronously — the site stays live but may return empty results briefly
          while collections are being replaced.
        </p>

        <div className="flex flex-col gap-3 max-w-md">
          <div className="flex items-center gap-3">
            <input
              ref={restoreInputRef}
              type="file"
              accept=".tar.gz,.tgz"
              className="hidden"
              onChange={handleFileChange}
            />
            <button type="button"
              onClick={() => restoreInputRef.current?.click()}
              disabled={restoring || hasActive}
              className="flex items-center gap-2 px-3 py-1.5 font-ui text-xs uppercase tracking-widest border border-base-300 hover:border-primary text-base-content/60 hover:text-base-content disabled:opacity-40 transition-colors">
              <Upload size={13} />
              {restoreFile ? restoreFile.name : 'Choose archive...'}
            </button>
            {restoreFile && (
              <button type="button" onClick={() => { setRestoreFile(null); setRestoreConfirm(false); if (restoreInputRef.current) restoreInputRef.current.value = '' }}
                className="p-1 text-base-content/30 hover:text-error transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {restoreFile && (
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={restoreConfirm} onChange={(e) => setRestoreConfirm(e.target.checked)}
                className="mt-0.5 accent-error" />
              <span className="font-ui text-xs text-error/80">
                I understand this will replace all current data on this server.
              </span>
            </label>
          )}

          {restoreFile && (
            <button type="button"
              onClick={handleRestore}
              disabled={!restoreConfirm || restoring || hasActive}
              className="flex items-center gap-2 w-fit px-5 py-2 font-ui text-xs uppercase tracking-widest bg-error text-error-content hover:opacity-90 disabled:opacity-40 transition-opacity">
              {restoring ? <Loader size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
              {restoring ? 'Starting restore...' : 'Restore now'}
            </button>
          )}

          {restoreError && <p className="font-ui text-xs text-error">{restoreError}</p>}
        </div>
      </div>
    </div>
  )
}

function MaintenanceSection({ settings, client, onSaved }) {
  const setting = settings.find((s) => s.name === 'gcRetentionDays')
  const [days, setDays] = useState(setting?.value ?? 30)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const dirty = days !== (setting?.value ?? 30)

  const saveGc = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await client.admin.updateSetting({ settingId: 'gcRetentionDays', value: days })
      onSaved('gcRetentionDays', days)
      setSaved(true)
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeading title="Maintenance" description="Housekeeping and data management." />
      <FieldRow label="Deleted content retention"
        description="Days to keep soft-deleted posts, users, files, and groups before the nightly garbage collection job permanently removes them.">
        <div className="flex items-center gap-3">
          <NumberInput value={days} onChange={(v) => { setDays(v); setSaved(false) }} min={1} max={365} disabled={saving} />
          <span className="font-ui text-sm text-base-content/50">days</span>
        </div>
      </FieldRow>
      <SaveBar saving={saving} saved={saved} error={error} onSave={saveGc} dirty={dirty} />

      <div className="mt-10 pt-8 border-t-2 border-base-300">
        <BackupSection client={client} />
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

const SECTION_MAP = {
  general:      GeneralSection,
  appearance:   AppearanceSection,
  users: UsersSection,
  email:        EmailSection,
  moderation:   ModerationSection,
  content:      ContentSection,
  media:        MediaSection,
  integrations: IntegrationsSection,
  maintenance:  MaintenanceSection,
}

export default function AdminSettingsPage() {
  const client = useClient()
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const tab = useHashTab('general')

  useEffect(() => {
    if (!client) return
    client.admin.getSettings()
      .then((res) => setSettings(res?.settings ?? []))
      .catch((err) => {
        if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
      })
      .finally(() => setLoading(false))
  }, [client])

  const handleSaved = (name, value) => {
    setSettings((prev) => prev.map((s) => s.name === name ? { ...s, value } : s))
  }

  if (denied) return (
    <div className="py-16 text-center">
      <p className="font-display text-3xl tracking-wide">Access Denied</p>
    </div>
  )

  const ActiveSection = SECTION_MAP[tab]

  return (
    <div>
      <div className="flex items-baseline justify-between border-b-2 border-base-300 pb-4">
        <h1 className="font-display text-5xl tracking-wide">Settings</h1>
      </div>

      <div className="flex gap-0 border-b border-base-300 mb-8 overflow-x-auto">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            className={`px-4 py-3 font-ui text-xs uppercase tracking-widest whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-primary text-base-content'
                : 'border-transparent text-base-content/50 hover:text-base-content'
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {loading ? (
        <Spinner centered />
      ) : (
        <ActiveSection key={tab} settings={settings} client={client} onSaved={handleSaved} />
      )}
    </div>
  )
}
