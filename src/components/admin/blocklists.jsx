// Admin block lists: the server's Blocked and Defederated circles, and the
// banned email address / domain lists. Used by AdminModerationPage.
//
// Phone-first: every list is stacked rows, never a wide table.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Pencil, X, Lock, Globe } from 'lucide-react'
import Spinner from '../ui/Spinner'
import {
  localDomains, parseTarget, isLocalPersonId, errStatus, fmtDay, BAN_WARNING,
} from './blocklistUtils'
import { useStaffRole } from '../../lib/staff'

const LABEL = 'font-ui text-xs uppercase tracking-widest text-base-content/50 mb-1 block'
const INPUT = 'w-full px-3 py-2 border-2 border-base-300 focus:border-primary bg-base-100 font-ui text-sm outline-none transition-colors'
const BTN_PRIMARY = 'px-5 py-2 border-2 border-primary text-primary font-ui text-xs uppercase tracking-widest hover:bg-primary hover:text-primary-content disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
const BTN_DANGER = 'px-5 py-2 bg-error text-error-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity'
const BTN_QUIET = 'px-4 py-1.5 border border-base-300 font-ui text-xs uppercase tracking-widest hover:bg-base-200 disabled:opacity-40 transition-colors'

function useLocals() {
  const viewerId = useSelector((state) => state.auth?.user?.id)
  return useMemo(() => localDomains(viewerId), [viewerId])
}

function Chip({ children, tone = 'muted' }) {
  const cls = tone === 'error'
    ? 'bg-error text-error-content'
    : 'bg-base-300 text-base-content/70'
  return <span className={`font-ui text-[10px] uppercase tracking-widest px-1.5 py-0.5 ${cls}`}>{children}</span>
}

function Avatar({ member }) {
  const initial = (member.name || member.id || '?').replace(/^@/, '').charAt(0).toUpperCase()
  if (member.icon) {
    return <img src={member.icon} alt="" loading="lazy" className="w-10 h-10 object-cover bg-base-300 shrink-0" />
  }
  return (
    <span className="w-10 h-10 shrink-0 bg-base-300 text-base-content/60 font-display text-lg flex items-center justify-center">
      {initial}
    </span>
  )
}

// The strong, inline "this is a ban" confirmation.
function BanConfirm({ name, message, busy, onConfirm, onCancel }) {
  return (
    <div className="border-2 border-error bg-error/5 p-4 mt-4">
      <p className="font-ui text-xs uppercase tracking-widest text-error mb-2">This is a ban</p>
      <p className="font-reading text-base text-base-content">{BAN_WARNING(name)}</p>
      {message && <p className="font-ui text-xs text-base-content/50 mt-2">{message}</p>}
      <p className="font-reading text-sm text-base-content/60 mt-2">
        Their username stays reserved and their email address is added to the banned emails list.
      </p>
      <div className="flex flex-wrap gap-3 mt-4">
        <button type="button" onClick={onConfirm} disabled={busy} className={BTN_DANGER}>
          {busy ? 'Banning...' : `Ban ${name} permanently`}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={BTN_QUIET}>Cancel</button>
      </div>
    </div>
  )
}

function MemberRow({ member, list, banned, busy, onSaveSummary, onRemove, canRemove = true }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(member.summary || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const ok = await onSaveSummary(member, draft.trim())
    setSaving(false)
    if (ok) setEditing(false)
  }

  return (
    <li className="py-4 border-b border-base-300">
      <div className="flex items-start gap-3">
        <Avatar member={member} />
        <div className="min-w-0 flex-1">
          <p className="font-ui text-sm font-medium break-words">{member.name || member.id}</p>
          <p className="font-ui text-xs text-base-content/50 break-all">{member.id}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Chip>{member.type === 'Server' ? 'Server' : 'Person'}</Chip>
            {banned && <Chip tone="error">Banned</Chip>}
            <span className="font-ui text-xs text-base-content/40">Added {fmtDay(member.createdAt)}</span>
          </div>
        </div>
        {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(member)}
          disabled={busy}
          className="shrink-0 p-1.5 text-base-content/40 hover:text-error disabled:opacity-30 transition-colors"
          title={`Remove from ${list === 'blocked' ? 'Blocked' : 'Defederated'}`}
          aria-label="Remove"
        >
          <X size={16} />
        </button>
        )}
      </div>

      <div className="mt-3 sm:ml-13">
        {editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className={`${INPUT} font-reading`}
              placeholder="Why is this on the list?"
              autoFocus
            />
            <div className="flex gap-3 mt-2">
              <button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" disabled={saving} className={BTN_QUIET}
                onClick={() => { setDraft(member.summary || ''); setEditing(false) }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className={`font-reading text-sm flex-1 min-w-0 break-words whitespace-pre-line ${member.summary ? 'text-base-content/80' : 'text-base-content/40 italic'}`}>
              {member.summary || 'No reason given.'}
            </p>
            <button type="button" onClick={() => setEditing(true)} disabled={busy}
              className="shrink-0 p-1 text-base-content/40 hover:text-primary disabled:opacity-30 transition-colors"
              title="Edit reason" aria-label="Edit reason">
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

function VisibilityToggle({ isPublic, busy, onChange }) {
  const opts = [
    [false, Lock, 'Private', 'admins only'],
    [true, Globe, 'Public', 'anyone can see this list and its reasons'],
  ]
  return (
    <div className="mb-6">
      <span className={LABEL}>Who can see this list</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border-2 border-base-300">
        {opts.map(([val, Icon, label, hint]) => (
          <button
            key={label}
            type="button"
            disabled={busy || isPublic === val}
            onClick={() => onChange(val)}
            className={`flex items-start gap-2 text-left px-3 py-2 transition-colors disabled:cursor-default ${
              isPublic === val ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}
          >
            <Icon size={14} className="mt-0.5 shrink-0" />
            <span>
              <span className="block font-ui text-xs uppercase tracking-widest">{label}</span>
              <span className="block font-ui text-xs opacity-75">({hint})</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const COPY = {
  blocked: {
    title: 'Blocked',
    intro: [
      'People and servers this server won\'t interact with.',
      'A remote person: everything they send is refused. A server: its replies and reactions are refused, but its posts still come in for members who follow people there. A person on this server: banned -- their account and posts are permanently deleted.',
    ],
    placeholder: '@name@example.org or example.org',
    reasonHint: 'If you make this list public, the reason is public too.',
    add: 'Add to Blocked',
    empty: 'Nobody is blocked. Anyone you add will be listed here.',
  },
  defederated: {
    title: 'Defederated',
    intro: [
      'Cut off completely: nothing in, nothing out, hidden from search and discovery. Use for spam, malware or hostile servers.',
      'Servers only, and stricter than Blocked. A server is only ever on one of the two lists.',
    ],
    placeholder: 'example.org',
    reasonHint: 'For your own records. This list is always private.',
    add: 'Defederate',
    empty: 'No servers are defederated.',
  },
}

export function BlocklistTab({ client, list }) {
  const copy = COPY[list]
  const locals = useLocals()
  const [data, setData] = useState(null) // null = loading
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [target, setTarget] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingBan, setPendingBan] = useState(null) // { name, message }
  // Moderators can't ban or unban members, or change who sees the list.
  const isMod = useStaffRole() === 'mod'

  const load = useCallback(async () => {
    if (!client) return
    try {
      const res = await client.admin.getBlocklists()
      setData(res?.[list] || { members: [] })
    } catch (err) {
      setError(err?.message || 'Could not load the list.')
      setData({ members: [] })
    }
  }, [client, list])

  useEffect(() => { load() }, [load])

  const submit = async (confirmBan = false) => {
    const t = target.trim()
    if (!t) return
    const parsed = parseTarget(t)
    setError(null)
    setNotice(null)
    if (!parsed) { setError('That doesn\'t look like a person or a server.'); return }
    if (list === 'defederated' && parsed.kind === 'person') {
      setError('Defederated is for servers only. To block a person, use Blocked.')
      return
    }
    if (isMod && parsed.kind === 'person' && locals.has(parsed.domain)) {
      setError('Only an admin can ban a member of this server. Report it to an admin, or close their account from Users.')
      return
    }
    if (!confirmBan && parsed.kind === 'person' && locals.has(parsed.domain)) {
      setPendingBan({ name: `@${parsed.name}`, message: null })
      return
    }
    setBusy(true)
    try {
      const res = await client.admin.addToBlocklist({
        list,
        target: t,
        summary: summary.trim() || undefined,
        ...(confirmBan ? { confirmBan: true } : {}),
      })
      const who = res?.member?.name || res?.member?.id || t
      setNotice(res?.banned
        ? `${who} is banned. Their account and posts have been deleted.`
        : `${who} added to ${copy.title}.`)
      setTarget('')
      setSummary('')
      setPendingBan(null)
      await load()
    } catch (err) {
      if (errStatus(err) === 409 && !confirmBan) {
        setPendingBan({ name: parsed.name ? `@${parsed.name}` : t, message: err?.message })
      } else {
        setError(err?.message || 'Could not add that to the list.')
        setPendingBan(null)
      }
    } finally {
      setBusy(false)
    }
  }

  const saveSummary = async (member, value) => {
    setError(null)
    try {
      await client.admin.updateBlocklistEntry({ list, id: member.id, summary: value })
      setData((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === member.id ? { ...m, summary: value } : m)),
      }))
      return true
    } catch (err) {
      setError(err?.message || 'Could not save the reason.')
      return false
    }
  }

  const remove = async (member) => {
    const name = member.name || member.id
    const banned = member.type !== 'Server' && isLocalPersonId(member.id, locals)
    const msg = banned
      ? `Remove ${name} from Blocked?\n\nThis only frees the username ${member.id} for someone to register. Their account and posts were deleted when they were banned and can't be restored. Their email stays banned until you remove it under Emails.`
      : `Remove ${name} from ${copy.title}? ${member.type === 'Server' ? 'That server' : 'They'} will be able to reach this server again.`
    if (!confirm(msg)) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await client.admin.removeFromBlocklist({ list, id: member.id })
      setData((prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== member.id) }))
      setNotice(`${name} removed from ${copy.title}.`)
    } catch (err) {
      setError(err?.message || 'Could not remove that entry.')
    } finally {
      setBusy(false)
    }
  }

  const setVisibility = async (isPublic) => {
    if (isPublic && !confirm('Make the Blocked list public?\n\nAnyone will be able to see who and what is on it, and the reason you gave for each entry. Check the reasons before you do this.')) return
    setBusy(true)
    setError(null)
    try {
      await client.admin.setBlocklistVisibility({ list, isPublic })
      setData((prev) => ({ ...prev, isPublic }))
    } catch (err) {
      setError(err?.message || 'Could not change who can see the list.')
    } finally {
      setBusy(false)
    }
  }

  const members = data?.members || []

  return (
    <div className="min-w-0">
      {copy.intro.map((p) => (
        <p key={p} className="font-reading text-sm text-base-content/70 mb-2">{p}</p>
      ))}

      <div className="mt-4">
        {list === 'blocked' && data && !isMod ? (
          <VisibilityToggle isPublic={!!data.isPublic} busy={busy} onChange={setVisibility} />
        ) : (
          <p className="flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-base-content/50 mb-6">
            {list === 'blocked' && isMod
              ? <>{data?.isPublic ? 'Public -- anyone can see this list' : 'Private -- staff only'}</>
              : <><Lock size={12} /> Private -- admins and moderators only</>}
          </p>
        )}
      </div>

      <form
        className="border-2 border-base-300 p-4 sm:p-5 mb-6"
        onSubmit={(e) => { e.preventDefault(); submit(false) }}
      >
        <label className={LABEL} htmlFor={`bl-target-${list}`}>{list === 'blocked' ? 'Person or server' : 'Server'}</label>
        <input
          id={`bl-target-${list}`}
          type="text"
          value={target}
          onChange={(e) => { setTarget(e.target.value); setPendingBan(null) }}
          placeholder={copy.placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={INPUT}
        />

        <label className={`${LABEL} mt-4`} htmlFor={`bl-reason-${list}`}>Reason</label>
        <textarea
          id={`bl-reason-${list}`}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="Why is this going on the list?"
          className={`${INPUT} font-reading`}
        />
        <p className="font-reading text-xs text-base-content/40 italic mt-1">{copy.reasonHint}</p>
        {isMod && list === 'defederated' && (
          <p className="font-reading text-xs text-base-content/40 italic mt-1">Every admin is told when a moderator defederates a server or lifts it.</p>
        )}

        {pendingBan ? (
          <BanConfirm
            name={pendingBan.name}
            message={pendingBan.message}
            busy={busy}
            onConfirm={() => submit(true)}
            onCancel={() => setPendingBan(null)}
          />
        ) : (
          <button type="submit" disabled={!target.trim() || busy} className={`${list === 'defederated' ? BTN_DANGER : BTN_PRIMARY} mt-4`}>
            {busy ? 'Adding...' : copy.add}
          </button>
        )}
      </form>

      {notice && <p className="font-ui text-sm text-success border-l-4 border-success pl-3 mb-4 break-words">{notice}</p>}
      {error && <p className="font-ui text-sm text-error border-l-4 border-error pl-3 mb-4 break-words">{error}</p>}

      <div className="flex items-baseline justify-between border-b-2 border-base-300 pb-2">
        <h2 className="font-display text-2xl tracking-wide">On the list</h2>
        {data && <span className="font-ui text-xs uppercase tracking-widest text-base-content/40">{members.length}</span>}
      </div>

      {data === null ? <Spinner centered /> : members.length === 0 ? (
        <p className="font-reading text-sm text-base-content/50 italic py-4">{copy.empty}</p>
      ) : (
        <ul>
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              list={list}
              banned={m.type !== 'Server' && isLocalPersonId(m.id, locals)}
              canRemove={!(isMod && m.type !== 'Server' && isLocalPersonId(m.id, locals))}
              busy={busy}
              onSaveSummary={saveSummary}
              onRemove={remove}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function EmailSection({ client, kind, title, intro, placeholder, entries, onChanged }) {
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const add = async (e) => {
    e.preventDefault()
    const v = value.trim()
    if (!v) return
    setBusy(true)
    setError(null)
    try {
      await client.admin.addBannedEmail({ kind, value: v, note: note.trim() || undefined })
      setValue('')
      setNote('')
      await onChanged()
    } catch (err) {
      setError(err?.message || 'Could not add that.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (entry) => {
    if (!confirm(`Remove ${entry.value}? It will be usable again for signups, email changes and invites.`)) return
    setBusy(true)
    setError(null)
    try {
      await client.admin.removeBannedEmail({ kind, value: entry.value })
      await onChanged()
    } catch (err) {
      setError(err?.message || 'Could not remove that.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-10 min-w-0">
      <div className="flex items-baseline justify-between border-b-2 border-base-300 pb-2 mb-3">
        <h2 className="font-display text-2xl tracking-wide">{title}</h2>
        <span className="font-ui text-xs uppercase tracking-widest text-base-content/40">{entries.length}</span>
      </div>
      <p className="font-reading text-sm text-base-content/60 mb-4">{intro}</p>

      <form onSubmit={add} className="border-2 border-base-300 p-4 mb-4">
        <label className={LABEL} htmlFor={`be-${kind}`}>{kind === 'email' ? 'Address' : 'Domain'}</label>
        <input
          id={`be-${kind}`}
          type={kind === 'email' ? 'email' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={INPUT}
        />
        <label className={`${LABEL} mt-3`} htmlFor={`be-note-${kind}`}>
          Note <span className="normal-case tracking-normal text-base-content/30">(optional, admins only)</span>
        </label>
        <input
          id={`be-note-${kind}`}
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why?"
          className={INPUT}
        />
        <button type="submit" disabled={!value.trim() || busy} className={`${BTN_PRIMARY} mt-4`}>
          {busy ? 'Adding...' : kind === 'email' ? 'Ban address' : 'Ban domain'}
        </button>
      </form>

      {error && <p className="font-ui text-sm text-error border-l-4 border-error pl-3 mb-3 break-words">{error}</p>}

      {entries.length === 0 ? (
        <p className="font-reading text-sm text-base-content/50 italic">Nothing here yet.</p>
      ) : (
        <ul>
          {entries.map((en) => (
            <li key={en.value} className="flex items-start gap-3 py-3 border-b border-base-300">
              <div className="min-w-0 flex-1">
                <p className="font-ui text-sm break-all">{en.value}</p>
                {en.note && <p className="font-reading text-sm text-base-content/60 break-words mt-0.5">{en.note}</p>}
                <p className="font-ui text-xs text-base-content/40 mt-0.5">Added {fmtDay(en.addedAt)}</p>
              </div>
              <button type="button" onClick={() => remove(en)} disabled={busy}
                className="shrink-0 p-1.5 text-base-content/40 hover:text-error disabled:opacity-30 transition-colors"
                title="Remove" aria-label={`Remove ${en.value}`}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function BannedEmailsTab({ client }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!client) return
    try {
      const res = await client.admin.getBannedEmails()
      setData({ emails: res?.emails || [], domains: res?.domains || [] })
    } catch (err) {
      setError(err?.message || 'Could not load banned emails.')
      setData({ emails: [], domains: [] })
    }
  }, [client])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-w-0">
      <p className="font-reading text-sm text-base-content/70 mb-2">
        Addresses and domains on these lists can't be used to sign up, to change an account's email, or to get an individual invite.
      </p>
      <p className="font-reading text-sm text-base-content/70 mb-6">
        When you ban someone on this server, their email address is added here automatically. Only admins can see these lists.
      </p>
      {error && <p className="font-ui text-sm text-error border-l-4 border-error pl-3 mb-4 break-words">{error}</p>}
      {data === null ? <Spinner centered /> : (
        <>
          <EmailSection
            client={client}
            kind="email"
            title="Addresses"
            intro="Exact addresses only."
            placeholder="name@example.com"
            entries={data.emails}
            onChanged={load}
          />
          <EmailSection
            client={client}
            kind="domain"
            title="Domains"
            intro="Every address at the domain. Use for disposable-mail providers and the like."
            placeholder="example.com"
            entries={data.domains}
            onChanged={load}
          />
        </>
      )}
    </div>
  )
}
