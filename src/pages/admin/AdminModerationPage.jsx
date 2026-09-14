// AdminModerationPage — review and act on flagged items.

import { useState, useEffect, useCallback, useRef } from 'react'
import { ExternalLink, Trash2, EyeOff, MoreVertical, UserX, Flame } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Flag.reason is a required Object ({code, label, description, details?} --
// see schema/Flag.js and ActivityParser/handlers/Flag/index.js), never a
// plain string -- rendering it directly threw "Objects are not valid as a
// React child" (minified error #31) for every flag with a reason set.
function reasonLabel(reason, fallback = '—') {
  if (!reason) return fallback
  if (typeof reason === 'string') return reason
  return reason.label || reason.description || reason.code || fallback
}

// Flag.target holds the flagged object's Kowloon ID -- the table/link logic
// here previously read flag.targetId, a field that doesn't exist on the
// schema (it's "target"), so the link and ID never rendered at all.
function targetPath(flag) {
  if (!flag?.target) return null
  const id = flag.target
  if (id.startsWith('post:') || id.startsWith('reply:')) return `/posts/${encodeURIComponent(id)}`
  if (id.startsWith('group:')) return `/groups/${encodeURIComponent(id)}`
  if (id.startsWith('circle:')) return `/circles/${encodeURIComponent(id)}`
  if (id.startsWith('page:')) return `/pages/${encodeURIComponent(id)}`
  if (id.startsWith('@')) return `/users/${encodeURIComponent(id)}`
  return null
}

// Kebab menu: Block Creator (deactivates the target's author account) and
// Hard Delete (permanently removes the item -- for material serious enough
// that even a soft-deleted record shouldn't linger). Both are one-way and
// confirmed before firing.
function ActionMenu({ flag, busy, onBlock, onHardDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickAway = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} disabled={busy}
        className="p-1 text-base-content/40 hover:text-base-content transition-colors disabled:opacity-30" title="More">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-base-100 border-2 border-base-300 shadow-lg flex flex-col">
          <button
            onClick={() => { setOpen(false); onBlock() }}
            disabled={!flag.targetActorId}
            className="flex items-center gap-2 px-3 py-2.5 text-left font-ui text-xs uppercase tracking-widest text-base-content hover:bg-base-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <UserX size={13} /> Block Creator
          </button>
          <button
            onClick={() => { setOpen(false); onHardDelete() }}
            className="flex items-center gap-2 px-3 py-2.5 text-left font-ui text-xs uppercase tracking-widest text-error hover:bg-error/10 transition-colors"
          >
            <Flame size={13} /> Hard Delete
          </button>
        </div>
      )}
    </div>
  )
}

// Server-level moderation. Two levels, matching schema/FederatedServer.js and
// enforced at the inbox:
//   Block      -- refuse replies and reacts from that server, but keep pulling
//                 its posts, so people here who already follow someone there
//                 don't silently lose them.
//   Defederate -- nothing in, nothing out, hidden from search and discovery.
// The input accepts @example.org, https://example.org or example.org; the
// server normalises all three (methods/parse/serverDomain.js).
function ServerModerationTab({ client }) {
  const [servers, setServers] = useState(null) // null = loading
  const [input, setInput] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!client) return
    try {
      const res = await client.admin.getModeratedServers()
      setServers(res.servers || [])
    } catch (err) {
      setError(err?.message || 'Could not load blocked servers')
      setServers([])
    }
  }, [client])

  useEffect(() => { load() }, [load])

  const act = async (level) => {
    if (!input.trim()) return
    setBusy(level)
    setError(null)
    try {
      await client.admin.moderateServer({ server: input.trim(), level, reason: reason.trim() || undefined })
      setInput('')
      setReason('')
      await load()
    } catch (err) {
      setError(err?.message || 'Could not block that server')
    } finally {
      setBusy(null)
    }
  }

  const unmoderate = async (domain) => {
    setBusy(domain)
    setError(null)
    try {
      await client.admin.unmoderateServer({ server: domain })
      setServers((prev) => prev.filter((s) => s.domain !== domain))
    } catch (err) {
      setError(err?.message || 'Could not unblock that server')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="border-2 border-base-300 p-5 mb-8">
        <label className="font-ui text-xs uppercase tracking-widest text-base-content/50 mb-1 block">
          Server
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="example.org"
          className="w-full px-3 py-2 border-2 border-base-300 focus:border-primary bg-base-100 font-ui text-sm outline-none transition-colors"
        />
        <p className="font-reading text-xs text-base-content/40 italic mt-1">
          Any of <span className="font-ui">example.org</span>,{' '}
          <span className="font-ui">@example.org</span> or{' '}
          <span className="font-ui">https://example.org</span> will do.
        </p>

        <label className="font-ui text-xs uppercase tracking-widest text-base-content/50 mt-4 mb-1 block">
          Reason <span className="normal-case tracking-normal text-base-content/30">(optional, for your own records)</span>
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you blocking this server?"
          className="w-full px-3 py-2 border-2 border-base-300 focus:border-primary bg-base-100 font-ui text-sm outline-none transition-colors"
        />

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button
            type="button"
            onClick={() => act('blocked')}
            disabled={!input.trim() || busy !== null}
            className="px-5 py-2 border-2 border-primary text-primary font-ui text-xs uppercase tracking-widest hover:bg-primary hover:text-primary-content disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy === 'blocked' ? 'Blocking…' : 'Block'}
          </button>
          <button
            type="button"
            onClick={() => act('suspended')}
            disabled={!input.trim() || busy !== null}
            className="px-5 py-2 bg-error text-error-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {busy === 'suspended' ? 'Defederating…' : 'Defederate'}
          </button>
          <p className="font-reading text-xs text-base-content/50 italic flex-1 min-w-64">
            <strong className="font-ui not-italic">Block</strong> stops replies and reactions from that
            server but keeps showing its posts.{' '}
            <strong className="font-ui not-italic">Defederate</strong> cuts it off completely.
          </p>
        </div>
      </div>

      {error && <p className="font-ui text-sm text-error mb-4">{error}</p>}

      {servers === null ? <Spinner centered /> : servers.length === 0 ? (
        <p className="font-reading text-sm text-base-content/50 italic">
          No servers are blocked. Anything you block will be listed here.
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-base-300">
              {['Server', 'Level', 'Reason', 'Since', ''].map((h) => (
                <th key={h} className="font-ui text-xs uppercase tracking-widest text-base-content/50 text-left pb-2 pr-4 last:pr-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => (
              <tr key={s.domain} className="border-b border-base-300">
                <td className="py-3 pr-4 font-ui text-sm">
                  {s.domain}
                  {s.name && <span className="block text-xs text-base-content/50">{s.name}</span>}
                </td>
                <td className="py-3 pr-4">
                  <span className={`font-ui text-xs uppercase tracking-widest px-2 py-1 ${
                    s.status === 'suspended' ? 'bg-error text-error-content' : 'bg-base-300 text-base-content/70'
                  }`}>
                    {s.status === 'suspended' ? 'Defederated' : 'Blocked'}
                  </span>
                </td>
                <td className="py-3 pr-4 font-reading text-sm text-base-content/60">{s.reason || '—'}</td>
                <td className="py-3 pr-4 font-ui text-xs text-base-content/50">
                  {s.since ? new Date(s.since).toLocaleDateString() : '—'}
                </td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => unmoderate(s.domain)}
                    disabled={busy !== null}
                    className="px-4 py-1.5 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 disabled:opacity-40 transition-colors"
                  >
                    {busy === s.domain ? 'Undoing…' : 'Undo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function AdminModerationPage() {
  const client = useClient()
  const [tab, setTab] = useState('reports')
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState('open')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!client) return
    setLoading(true)
    try {
      const res = await client.admin.getFlagged({ status: filter })
      setFlags(res?.orderedItems ?? [])
    } catch (err) {
      if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
    } finally {
      setLoading(false)
    }
  }, [client, filter])

  useEffect(() => { load() }, [load])

  // Row actions only render while viewing the "open" filter, and every one
  // of them resolves the flag away from "open" -- so on success it simply
  // drops out of the current (open-only) list.
  const runAction = async (flag, action) => {
    setBusyId(flag.id)
    setError(null)
    try {
      await action()
      setFlags((prev) => prev.filter((f) => f.id !== flag.id))
    } catch (err) {
      setError(err?.message || 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const handleIgnore = (flag) => runAction(flag, () => client.admin.ignoreFlag({ flagId: flag.id }))

  const handleRemove = (flag) => {
    if (!confirm(`Remove this ${flag.targetType || 'item'}? Its author will be notified.`)) return
    runAction(flag, () => client.admin.removeFlaggedItem({ flagId: flag.id }))
  }

  const handleBlock = (flag) => {
    if (!confirm(`Deactivate ${flag.targetActorId}'s account? This can be undone from Users, but they'll be logged out immediately.`)) return
    runAction(flag, () => client.admin.blockFlaggedAuthor({ flagId: flag.id }))
  }

  const handleHardDelete = (flag) => {
    if (!confirm(`Permanently delete this ${flag.targetType || 'item'}? This cannot be undone.`)) return
    runAction(flag, () => client.admin.hardDeleteFlaggedItem({ flagId: flag.id }))
  }

  if (denied) return (
    <div className="py-16 text-center"><p className="font-display text-3xl tracking-wide">Access Denied</p></div>
  )

  const FILTERS = [['open', 'Open'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']]

  return (
    <div>
      <div className="flex items-baseline justify-between border-b-2 border-base-300 pb-4 mb-6">
        <h1 className="font-display text-5xl tracking-wide">Moderation</h1>
        {tab === 'reports' && (
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/40">{flags.length} items</span>
        )}
      </div>

      <div className="flex gap-6 border-b-2 border-base-300 mb-6">
        {[['reports', 'Reports'], ['servers', 'Servers']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            className={`pb-3 -mb-0.5 font-display text-xl tracking-wide border-b-2 transition-colors ${
              tab === val ? 'border-primary text-base-content' : 'border-transparent text-base-content/40 hover:text-base-content/70'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'servers' ? <ServerModerationTab client={client} /> : (
      <>
      <div className="flex gap-0 mb-6">
        {FILTERS.map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors ${
              filter === val ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="font-ui text-sm text-error mb-4">{error}</p>}

      {loading ? <Spinner centered /> : (
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-base-300">
              {['Target', 'Author', 'Reporter', 'Reason', 'Flagged', 'Status', ''].map((h) => (
                <th key={h} className="font-ui text-xs uppercase tracking-widest text-base-content/50 text-left pb-2 pr-4 last:pr-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => {
              const path = targetPath(flag)
              const busy = busyId === flag.id
              return (
                <tr key={flag.id} className="border-b border-base-300 hover:bg-base-200">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-base-content/50 max-w-36 truncate block">{flag.target ?? '—'}</span>
                      {path && (
                        <Link to={path} className="p-0.5 text-base-content/30 hover:text-base-content transition-colors" title="View">
                          <ExternalLink size={11} />
                        </Link>
                      )}
                    </div>
                    {flag.targetType && (
                      <span className="font-ui text-xs uppercase tracking-widest text-base-content/40">{flag.targetType}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50 max-w-28 truncate">{flag.targetActorId ?? '—'}</td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50 max-w-28 truncate">{flag.actorId ?? '—'}</td>
                  <td className="py-3 pr-4 font-ui text-sm max-w-48">
                    <span className="line-clamp-2">{reasonLabel(flag.reason)}</span>
                    {flag.notes && <span className="block font-ui text-xs text-base-content/40 mt-0.5 line-clamp-1">{flag.notes}</span>}
                  </td>
                  <td className="py-3 pr-4 font-ui text-xs text-base-content/50 whitespace-nowrap">{fmtDate(flag.createdAt)}</td>
                  <td className="py-3 pr-4">
                    <span className={`font-ui text-xs uppercase tracking-widest px-2 py-0.5 ${
                      flag.status === 'open' ? 'bg-warning/15 text-warning' :
                      flag.status === 'resolved' ? 'bg-success/15 text-success' :
                      'bg-base-300 text-base-content/50'
                    }`}>
                      {flag.status}
                    </span>
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {flag.status === 'open' && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleRemove(flag)} disabled={busy}
                          className="p-1 text-base-content/40 hover:text-error transition-colors disabled:opacity-30" title="Remove item">
                          <Trash2 size={14} />
                        </button>
                        <button onClick={() => handleIgnore(flag)} disabled={busy}
                          className="p-1 text-base-content/40 hover:text-base-content transition-colors disabled:opacity-30" title="Ignore">
                          <EyeOff size={14} />
                        </button>
                        <ActionMenu flag={flag} busy={busy} onBlock={() => handleBlock(flag)} onHardDelete={() => handleHardDelete(flag)} />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {flags.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center font-ui text-xs uppercase tracking-widest text-base-content/40">
                {filter === 'open' ? 'No open flags — all clear.' : 'No items found.'}
              </td></tr>
            )}
          </tbody>
        </table>
      )}
      </>
      )}
    </div>
  )
}
