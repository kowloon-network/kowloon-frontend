// AdminReportPage -- one moderation report: what was reported, by whom, why,
// and the four things an admin can do about it.

import { useState, useEffect, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Trash2, EyeOff, UserX, Flame } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'
import sizedUrl from '../../lib/sizedUrl'
import { StatusChip } from '../../components/admin/reports'
import { fmtDate, reasonLabel, targetPath, personName, TYPE_LABELS } from '../../components/admin/reportUtils'

function Field({ label, children }) {
  return (
    <div className="py-3 border-b border-base-300">
      <p className="font-ui text-[11px] uppercase tracking-widest text-base-content/50 mb-1">{label}</p>
      <div className="font-ui text-sm">{children}</div>
    </div>
  )
}

function PersonLink({ person, id }) {
  const pid = person?.id || id
  if (!pid) return <span className="text-base-content/40">--</span>
  return (
    <Link to={`/users/${encodeURIComponent(pid)}`} className="hover:text-primary transition-colors">
      <span className="font-medium">{personName(person, id)}</span>
      {person?.name && <span className="block text-xs text-base-content/50 truncate">{pid}</span>}
    </Link>
  )
}

function ActionButton({ icon: Icon, label, hint, onClick, busy, danger, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`flex items-start gap-3 w-full text-left px-4 py-3 border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? 'border-error/40 hover:border-error hover:bg-error/5' : 'border-base-300 hover:border-primary hover:bg-primary/5'
      }`}
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${danger ? 'text-error' : 'text-base-content/60'}`} />
      <span className="min-w-0">
        <span className={`block font-ui text-xs uppercase tracking-widest ${danger ? 'text-error' : ''}`}>{label}</span>
        <span className="block font-ui text-xs text-base-content/50 mt-0.5">{hint}</span>
      </span>
    </button>
  )
}

export default function AdminReportPage() {
  const { id } = useParams()
  const client = useClient()
  const [flag, setFlag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const load = useCallback(async () => {
    if (!client) return
    try {
      const res = await client.admin.getFlag({ flagId: id })
      setFlag(res?.flag ?? null)
      if (!res?.flag) setNotFound(true)
    } catch (err) {
      if (err?.status === 404 || err?.statusCode === 404) setNotFound(true)
      else setError(err?.message || "Couldn't load this report.")
    } finally {
      setLoading(false)
    }
  }, [client, id])

  useEffect(() => { load() }, [load])

  const run = async (confirmText, action, doneText) => {
    if (confirmText && !confirm(confirmText)) return
    setBusy(true)
    setError(null)
    try {
      await action()
      setDone(doneText)
      await load()
    } catch (err) {
      setError(err?.message || 'That didn’t work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner centered />

  const back = (
    <Link to="/admin/moderation" className="inline-flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-base-content/50 hover:text-primary transition-colors mb-4">
      <ArrowLeft size={13} /> Moderation
    </Link>
  )

  if (notFound || !flag) return (
    <div>
      {back}
      <p className="font-display text-3xl tracking-wide">Report not found</p>
      {error && <p className="font-ui text-sm text-error mt-2">{error}</p>}
    </div>
  )

  const t = flag.targetSummary || {}
  const typeLabel = TYPE_LABELS[flag.targetType] || flag.targetType || 'Item'
  const path = targetPath(flag)
  const isOpen = flag.status === 'open'
  const authorName = personName(flag.targetActor, flag.targetActorId)
  const images = [
    ...(t.image ? [{ url: t.image, mediaType: 'image/' }] : []),
    ...(t.attachments || []).filter((a) => a?.mediaType?.startsWith('image/')),
  ].slice(0, 4)

  return (
    <div className="max-w-2xl">
      {back}

      <div className="flex items-center gap-3 mb-2">
        <StatusChip status={flag.status} />
        <span className="font-ui text-xs uppercase tracking-widest text-base-content/50">{typeLabel} -- reported {fmtDate(flag.createdAt)}</span>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl tracking-wide mb-6 break-words">
        {reasonLabel(flag.reason, 'Report')}
      </h1>

      {done && <p className="font-ui text-sm text-success border-l-4 border-success pl-3 mb-4">{done}</p>}
      {error && <p className="font-ui text-sm text-error border-l-4 border-error pl-3 mb-4">{error}</p>}

      {/* The reported thing itself */}
      <section className="border-2 border-base-300 p-4 mb-6">
        <p className="font-ui text-[11px] uppercase tracking-widest text-base-content/50 mb-2">
          What was reported{t.removed ? ' -- removed' : ''}
        </p>
        {t.exists === false ? (
          <p className="font-ui text-sm text-base-content/50">This {typeLabel.toLowerCase()} no longer exists.</p>
        ) : (
          <>
            {t.title && <p className={`font-display text-xl tracking-wide mb-1 ${t.removed ? 'line-through text-base-content/50' : ''}`}>{t.title}</p>}
            {t.excerpt && t.excerpt !== t.title && (
              <p className="font-reading text-base text-base-content/80 whitespace-pre-line">{t.excerpt}</p>
            )}
            {images.length > 0 && (
              <div className={`grid gap-1 mt-3 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {images.map((img) => (
                  <img key={img.url} src={sizedUrl(img.url, 400)} alt="" loading="lazy" className="w-full aspect-square object-cover bg-base-300" />
                ))}
              </div>
            )}
          </>
        )}
        {path && t.exists !== false && (
          <Link to={path} className="inline-flex items-center gap-1.5 mt-3 font-ui text-xs uppercase tracking-widest text-primary hover:underline">
            See it in context <ExternalLink size={12} />
          </Link>
        )}
      </section>

      <div className="mb-8">
        <Field label="Posted by"><PersonLink person={flag.targetActor} id={flag.targetActorId} /></Field>
        <Field label="Reported by"><PersonLink person={flag.reporter} id={flag.actorId} /></Field>
        {flag.notes && <Field label="Reporter's note"><p className="font-reading text-base whitespace-pre-line">{flag.notes}</p></Field>}
        {!isOpen && (
          <Field label={flag.status === 'dismissed' ? 'Dismissed' : 'Resolved'}>
            {fmtDate(flag.resolvedAt)}
            {flag.resolver && <> by <PersonLink person={flag.resolver} id={flag.resolvedBy} /></>}
          </Field>
        )}
      </div>

      {isOpen && (
        <section>
          <h2 className="font-display text-2xl tracking-wide border-b-2 border-base-300 pb-2 mb-4">What to do</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton
              icon={EyeOff}
              label="Ignore"
              hint="Nothing needs doing. The reporter is told no action was taken."
              busy={busy}
              onClick={() => run(null, () => client.admin.ignoreFlag({ flagId: flag.id }), 'Report dismissed. The reporter has been told.')}
            />
            <ActionButton
              icon={Trash2}
              label="Remove"
              hint="Take it down. The reporter and the author are both told."
              busy={busy}
              disabled={t.exists === false}
              onClick={() => run(
                `Remove this ${typeLabel.toLowerCase()}? ${authorName} will be notified.`,
                () => client.admin.removeFlaggedItem({ flagId: flag.id }),
                'Removed. The reporter and the author have been told.',
              )}
            />
            <ActionButton
              icon={UserX}
              label="Block creator"
              hint="Close the author's account and sign them out."
              danger
              busy={busy}
              disabled={!flag.targetActorId}
              onClick={() => run(
                `Close ${authorName}'s account? They'll be signed out straight away. You can restore it from Users.`,
                () => client.admin.blockFlaggedAuthor({ flagId: flag.id }),
                `${authorName}'s account is closed. The reporter has been told.`,
              )}
            />
            <ActionButton
              icon={Flame}
              label="Delete permanently"
              hint="Gone for good, straight away. Can't be undone."
              danger
              busy={busy}
              disabled={t.exists === false}
              onClick={() => run(
                `Permanently delete this ${typeLabel.toLowerCase()}? This can't be undone.`,
                () => client.admin.hardDeleteFlaggedItem({ flagId: flag.id }),
                'Deleted permanently.',
              )}
            />
          </div>
        </section>
      )}
    </div>
  )
}
