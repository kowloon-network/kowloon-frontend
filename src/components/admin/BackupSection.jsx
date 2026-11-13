// BackupSection -- Settings -> Maintenance: automatic backups, backing up
// now, every backup on the server, and restoring.
//
// Backups are the admin's call (Josh 2026-11-13): off by default, and the
// page shows what they cost in disk space before you turn them on. The
// schedule and pruning run on the server (server/methods/backup/manage.js).

import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, X, Loader, Download, AlertTriangle, Database, Archive } from 'lucide-react'
import Spinner from '../ui/Spinner'

const FREQ = [['off', 'Off'], ['daily', 'Daily'], ['weekly', 'Weekly']]
const HOURS = Array.from({ length: 24 }, (_, h) => h)

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return '--'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

const fmtWhen = (d) => (d ? new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const kindLabel = (kind) => (kind === 'database' ? 'Database' : 'Everything')

function Segmented({ value, onChange, options, disabled, label }) {
  return (
    <div className="flex" role="radiogroup" aria-label={label}>
      {options.map(([val, text]) => (
        <button
          key={val}
          type="button"
          role="radio"
          aria-checked={value === val}
          disabled={disabled}
          onClick={() => onChange(val)}
          className={`px-4 py-2 font-ui text-xs uppercase tracking-widest border-r border-base-300 last:border-r-0 transition-colors disabled:opacity-40 ${
            value === val ? 'bg-secondary text-secondary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function Heading({ children, sub }) {
  return (
    <div className="mb-3">
      <h3 className="font-display text-xl tracking-wide">{children}</h3>
      {sub && <p className="font-ui text-sm text-base-content/50 mt-1 max-w-prose">{sub}</p>}
    </div>
  )
}

// ---- One backup (or a job still running / failed) ------------------------

function BackupRow({ job, client, onDeleted }) {
  const [busy, setBusy] = useState(null) // 'download' | 'delete'
  const [err, setErr] = useState(null)
  const isActive = job.status === 'pending' || job.status === 'running'
  const isBackup = job.type === 'backup'

  const download = async () => {
    setBusy('download'); setErr(null)
    try {
      const token = await client.http.getToken()
      const res = await fetch(client.admin.backupDownloadUrl(job._id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = job.archiveName || `kowloon-backup-${job._id}.tar.gz`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErr(e?.message || 'Download failed')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    const what = job.status === 'done' ? `this ${kindLabel(job.kind).toLowerCase()} backup${job.sizeBytes ? ` (${formatBytes(job.sizeBytes)})` : ''}` : 'this entry'
    if (!window.confirm(`Delete ${what}? It can't be recovered.`)) return
    setBusy('delete'); setErr(null)
    try {
      await client.admin.deleteBackup(job._id)
      onDeleted(job._id)
    } catch (e) {
      setErr(e?.message || 'Could not delete it')
      setBusy(null)
    }
  }

  let status = null
  if (job.status === 'failed') status = <span className="text-error">Failed: {job.error || 'unknown error'}</span>
  else if (job.status === 'running') status = <span className="text-warning">{job.progress?.stage || 'Running'} ({job.progress?.pct ?? 0}%)</span>
  else if (job.status === 'pending') status = <span className="text-base-content/50">Queued</span>

  return (
    <li className="flex items-start gap-3 py-3 border-b border-base-300">
      <span className="mt-0.5 text-base-content/40 shrink-0">
        {isBackup ? (job.kind === 'database' ? <Database size={16} /> : <Archive size={16} />) : <Upload size={16} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm">
          {isBackup ? kindLabel(job.kind) : 'Restore'}
          <span className="text-base-content/50"> -- {fmtWhen(job.createdAt)}</span>
        </p>
        <p className="font-ui text-xs text-base-content/50 mt-0.5 flex flex-wrap gap-x-2">
          {isBackup && <span>{job.trigger === 'scheduled' ? 'Automatic' : 'Made by hand'}</span>}
          {job.status === 'done' && job.sizeBytes != null && <span className="tabular-nums">{formatBytes(job.sizeBytes)}</span>}
          {status}
        </p>
        {job.status === 'running' && (
          <div className="mt-1.5 w-48 h-1 bg-base-300 overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${job.progress?.pct ?? 0}%` }} />
          </div>
        )}
        {err && <p className="font-ui text-xs text-error mt-1">{err}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {job.status === 'done' && isBackup && (
          <button type="button" onClick={download} disabled={!!busy} title="Download" aria-label="Download"
            className="p-1.5 text-base-content/50 hover:text-primary disabled:opacity-30 transition-colors">
            {busy === 'download' ? <Loader size={15} className="animate-spin" /> : <Download size={15} />}
          </button>
        )}
        {!isActive && (
          <button type="button" onClick={remove} disabled={!!busy} title="Delete" aria-label="Delete"
            className="p-1.5 text-base-content/40 hover:text-error disabled:opacity-30 transition-colors">
            {busy === 'delete' ? <Loader size={15} className="animate-spin" /> : <X size={15} />}
          </button>
        )}
      </div>
    </li>
  )
}

// ---- Automatic backups ---------------------------------------------------

function ScheduleForm({ client, summary, onSaved }) {
  const saved = summary.schedule
  const [draft, setDraft] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [justSaved, setJustSaved] = useState(false)

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const set = (k, v) => { setDraft((d) => ({ ...d, [k]: v })); setJustSaved(false) }

  const est = summary.estimate || {}
  const steady =
    (draft.database !== 'off' ? draft.keep * (est.databaseBytes || 0) : 0) +
    (draft.full !== 'off' ? draft.keep * (est.fullBytes || 0) : 0)
  const free = summary.disk?.freeBytes
  const enabled = draft.database !== 'off' || draft.full !== 'off'
  const tight = enabled && free != null && steady > free * 0.5

  const save = async () => {
    const wasOff = saved.database === 'off' && saved.full === 'off'
    if (wasOff && enabled) {
      const msg = `Turn on automatic backups?\n\nOnce ${draft.keep} of each are kept they'll use about ${formatBytes(steady)} of disk space` +
        (free != null ? ` (${formatBytes(free)} is free now).` : '.') +
        `\n\nThey're stored on this server, so download the important ones and keep a copy somewhere else.`
      if (!window.confirm(msg)) return
    }
    setSaving(true); setError(null)
    try {
      await client.admin.setBackupSchedule(draft)
      setJustSaved(true)
      onSaved()
    } catch (e) {
      setError(e?.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="font-ui text-xs uppercase tracking-widest text-base-content/60">The database</p>
        <Segmented label="Back up the database" value={draft.database} onChange={(v) => set('database', v)} options={FREQ} disabled={saving} />
        <p className="font-ui text-xs text-base-content/50">
          Posts, accounts, settings -- everything except uploaded photos and video. About {formatBytes(est.databaseBytes)} each.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-ui text-xs uppercase tracking-widest text-base-content/60">Everything</p>
        <Segmented label="Back up everything" value={draft.full} onChange={(v) => set('full', v)} options={FREQ} disabled={saving} />
        <p className="font-ui text-xs text-base-content/50">
          The database and every uploaded file. About {formatBytes(est.fullBytes)} each -- this is what fills a disk.
        </p>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex flex-col gap-1.5">
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/60">Keep the last</span>
          <span className="flex items-center gap-2">
            <input type="number" min={1} max={60} value={draft.keep} disabled={saving}
              onChange={(e) => set('keep', Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none w-20 tabular-nums" />
            <span className="font-ui text-sm text-base-content/50">of each</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/60">At</span>
          <span className="flex items-center gap-2">
            <select value={draft.hour} disabled={saving} onChange={(e) => set('hour', Number(e.target.value))}
              className="border-2 border-base-300 focus:border-primary bg-base-100 px-3 py-2 font-ui text-sm outline-none tabular-nums">
              {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
            <span className="font-ui text-sm text-base-content/50">UTC</span>
          </span>
        </label>
      </div>

      {enabled && (
        <p className={`font-ui text-sm ${tight ? 'text-warning' : 'text-base-content/70'}`}>
          {tight && <AlertTriangle size={14} className="inline -mt-0.5 mr-1.5" />}
          These settings will use about <strong className="tabular-nums">{formatBytes(steady)}</strong> once {draft.keep} of each are kept
          {free != null && <> -- <span className="tabular-nums">{formatBytes(free)}</span> is free now</>}.
          {tight && ' That leaves little room for new uploads; keep fewer, or back up everything less often.'}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={save} disabled={saving || !dirty}
          className="px-5 py-2 font-ui text-xs uppercase tracking-widest bg-primary text-primary-content hover:opacity-90 disabled:opacity-40 transition-opacity">
          {saving ? 'Saving...' : 'Save'}
        </button>
        {justSaved && !dirty && <span className="font-ui text-xs uppercase tracking-widest text-success">Saved</span>}
        {error && <span className="font-ui text-xs text-error">{error}</span>}
      </div>

      {!dirty && (saved.database !== 'off' || saved.full !== 'off') && (
        <p className="font-ui text-xs text-base-content/50">
          Next:{' '}
          {[
            summary.next?.full && `everything ${fmtWhen(summary.next.full)}`,
            summary.next?.database && `database ${fmtWhen(summary.next.database)}`,
          ].filter(Boolean).join('; ')}
          . Older automatic backups are deleted once a new one succeeds; ones made by hand are kept until you delete them.
          If one fails, every admin gets an email.
        </p>
      )}
    </div>
  )
}

// ---- The whole section ---------------------------------------------------

export default function BackupSection({ client }) {
  const [jobs, setJobs] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [starting, setStarting] = useState(null) // 'database' | 'full'
  const [startError, setStartError] = useState(null)
  const [restoreFile, setRestoreFile] = useState(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState(null)
  const [restoreConfirm, setRestoreConfirm] = useState(false)
  const restoreInputRef = useRef(null)

  const load = useCallback(async () => {
    if (!client) return
    try {
      const [list, sum] = await Promise.all([client.admin.listBackups(), client.admin.backupSummary()])
      setJobs(list?.jobs ?? [])
      setSummary(sum)
      setLoadError(null)
    } catch (e) {
      setLoadError(e?.message || 'Could not load backups')
      setJobs((j) => j ?? [])
    }
  }, [client])

  useEffect(() => { load() }, [load])

  const hasActive = (jobs || []).some((j) => j.status === 'pending' || j.status === 'running')
  useEffect(() => {
    if (!hasActive) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [hasActive, load])

  const start = async (kind) => {
    setStarting(kind); setStartError(null)
    try {
      await client.admin.createBackup({ kind })
      await load()
    } catch (e) {
      setStartError(e?.message || 'Could not start the backup')
    } finally {
      setStarting(null)
    }
  }

  const restore = async () => {
    if (!restoreFile || !restoreConfirm) return
    setRestoring(true); setRestoreError(null)
    try {
      await client.admin.restoreFromFile(restoreFile)
      setRestoreFile(null); setRestoreConfirm(false)
      if (restoreInputRef.current) restoreInputRef.current.value = ''
      await load()
    } catch (e) {
      setRestoreError(e?.message || 'Could not start the restore')
    } finally {
      setRestoring(false)
    }
  }

  if (jobs === null) return <Spinner />

  const est = summary?.estimate || {}
  const disk = summary?.disk

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Heading sub="A backup is a copy of the server you can restore from. Backups are stored on this server, so they protect against mistakes and crashes but not against losing the machine -- download the ones that matter and keep them somewhere else. Your host may also back up the server; ask them.">
          Backups
        </Heading>
        {loadError && <p className="font-ui text-xs text-error mb-3">{loadError}</p>}
        {summary && (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="bg-base-200 px-4 py-3">
              <dt className="font-ui text-[10px] uppercase tracking-widest text-base-content/50">Backups use</dt>
              <dd className="font-display text-2xl tabular-nums">{formatBytes(summary.usedBytes)}</dd>
              <dd className="font-ui text-xs text-base-content/50">{summary.count} {summary.count === 1 ? 'backup' : 'backups'}</dd>
            </div>
            <div className="bg-base-200 px-4 py-3">
              <dt className="font-ui text-[10px] uppercase tracking-widest text-base-content/50">Free disk</dt>
              <dd className="font-display text-2xl tabular-nums">{disk ? formatBytes(disk.freeBytes) : '--'}</dd>
              <dd className="font-ui text-xs text-base-content/50">{disk ? `of ${formatBytes(disk.totalBytes)}` : 'not available'}</dd>
            </div>
            <div className="bg-base-200 px-4 py-3 col-span-2 sm:col-span-1">
              <dt className="font-ui text-[10px] uppercase tracking-widest text-base-content/50">One backup is about</dt>
              <dd className="font-ui text-sm mt-1 tabular-nums">Database {formatBytes(est.databaseBytes)}</dd>
              <dd className="font-ui text-sm tabular-nums">Everything {formatBytes(est.fullBytes)}</dd>
            </div>
          </dl>
        )}
      </div>

      {summary && (
        <div className="pt-6 border-t-2 border-base-300">
          <Heading sub="Off unless you turn it on. Back up the database often and everything less often -- the database is small; photos and video are what fill a disk.">
            Automatic backups
          </Heading>
          {/* Remounts (fresh draft) whenever the saved schedule changes. */}
          <ScheduleForm key={JSON.stringify(summary.schedule)} client={client} summary={summary} onSaved={load} />
        </div>
      )}

      <div className="pt-6 border-t-2 border-base-300">
        <Heading sub="Kept until you delete them. You'll get an email when it's ready to download.">Back up now</Heading>
        <div className="flex flex-wrap gap-3">
          {[['database', 'Back up the database', Database], ['full', 'Back up everything', Archive]].map(([kind, label, Icon]) => (
            <button key={kind} type="button" onClick={() => start(kind)} disabled={!!starting || hasActive}
              className="flex items-center gap-2 px-5 py-2 font-ui text-xs uppercase tracking-widest bg-secondary text-secondary-content hover:opacity-90 disabled:opacity-40 transition-opacity">
              {starting === kind ? <Loader size={13} className="animate-spin" /> : <Icon size={13} />}
              {label}
            </button>
          ))}
        </div>
        {hasActive && <p className="font-ui text-xs uppercase tracking-widest text-warning mt-3">A backup or restore is running...</p>}
        {startError && <p className="font-ui text-xs text-error mt-3">{startError}</p>}

        {jobs.length > 0 ? (
          <ul className="mt-6 border-t border-base-300">
            {jobs.map((job) => (
              <BackupRow key={job._id} job={job} client={client}
                onDeleted={(id) => { setJobs((js) => js.filter((j) => j._id !== id)); load() }} />
            ))}
          </ul>
        ) : (
          <p className="font-ui text-sm text-base-content/50 mt-6">No backups yet.</p>
        )}
      </div>

      <div className="pt-6 border-t-2 border-base-300">
        <Heading sub="Upload a .tar.gz archive made by this server. A full backup replaces the database and uploaded files; a database backup replaces only the database. The site stays up, but may look empty for a moment while it's replaced.">
          Restore from a backup
        </Heading>
        <div className="flex flex-col gap-3 max-w-md">
          <div className="flex items-center gap-3">
            <input ref={restoreInputRef} type="file" accept=".tar.gz,.tgz" className="hidden"
              onChange={(e) => { setRestoreFile(e.target.files?.[0] || null); setRestoreConfirm(false); setRestoreError(null) }} />
            <button type="button" onClick={() => restoreInputRef.current?.click()} disabled={restoring || hasActive}
              className="flex items-center gap-2 px-3 py-1.5 font-ui text-xs uppercase tracking-widest border border-base-300 hover:border-primary text-base-content/60 hover:text-base-content disabled:opacity-40 transition-colors min-w-0">
              <Upload size={13} className="shrink-0" />
              <span className="truncate">{restoreFile ? restoreFile.name : 'Choose archive...'}</span>
            </button>
            {restoreFile && (
              <button type="button" aria-label="Clear"
                onClick={() => { setRestoreFile(null); setRestoreConfirm(false); if (restoreInputRef.current) restoreInputRef.current.value = '' }}
                className="p-1 text-base-content/30 hover:text-error transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          {restoreFile && (
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={restoreConfirm} onChange={(e) => setRestoreConfirm(e.target.checked)} className="mt-0.5 accent-error" />
              <span className="font-ui text-xs text-error/80">I understand this replaces what's on the server now.</span>
            </label>
          )}
          {restoreFile && (
            <button type="button" onClick={restore} disabled={!restoreConfirm || restoring || hasActive}
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
