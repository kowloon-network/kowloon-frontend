// ReportDialog -- report a post, person, reply or group to this server's
// moderators. Lists the reasons the admin configured (settings.flagOptions,
// loaded with the server info), plus an optional note. Matches the app's
// FlagSheet. Rendered through a portal so a transformed or overflow-hidden
// ancestor (post cards, toolbars) can't clip it.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import { useClient } from '../../hooks/useClient'
import { toast } from '../../app/toast'

const FALLBACK = {
  spam: { label: 'Spam' },
  harassment: { label: 'Harassment or Bullying' },
  misinformation: { label: 'Misinformation' },
  other: { label: 'Other' },
}

export default function ReportDialog({ open, onClose, targetId, noun = 'post' }) {
  const { t } = useTranslation()
  const client = useClient()
  const configured = useSelector((s) => s.server?.settings?.flagOptions)
  const options = configured && typeof configured === 'object' && Object.keys(configured).length
    ? configured
    : FALLBACK
  const [reason, setReason] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const close = () => {
    if (busy) return
    setReason(null)
    setNotes('')
    onClose()
  }

  const submit = async () => {
    if (!reason || busy) return
    setBusy(true)
    try {
      await client.activities.flag({ targetId, reason, notes: notes.trim() || undefined })
      toast.success(t('report.done', { defaultValue: 'Reported. A moderator will review this {{noun}}.', noun }))
      setBusy(false)
      setReason(null)
      setNotes('')
      onClose()
    } catch (err) {
      toast.error(t('report.failed', { defaultValue: "Couldn't report" }), { detail: err?.message })
      setBusy(false)
    }
  }

  return createPortal(
    <Modal open onClose={close} title={t('report.title', { defaultValue: 'Report this {{noun}}', noun })}>
      <div className="flex flex-col gap-4">
        <p className="font-reading text-sm text-base-content/70">
          {t('report.intro', { defaultValue: "Choose the reason that fits best. Only this server's moderators see your report." })}
        </p>
        <div role="radiogroup" className="flex flex-col max-h-[45vh] overflow-y-auto border-y border-base-300">
          {Object.entries(options).map(([code, meta]) => {
            const active = reason === code
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setReason(code)}
                className={`text-left px-3 py-2.5 border-b border-base-300 last:border-b-0 border-l-4 transition-colors ${
                  active ? 'border-l-primary bg-base-200' : 'border-l-transparent hover:bg-base-200'
                }`}
              >
                <span className={`block font-ui text-sm ${active ? 'font-semibold' : ''}`}>{meta?.label || code}</span>
                {meta?.description && (
                  <span className="block font-ui text-xs mt-0.5 text-base-content/60">
                    {meta.description}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/50">
            {t('report.notes', { defaultValue: 'Anything the moderators should know (optional)' })}
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            className="textarea textarea-bordered w-full font-reading text-sm rounded-none"
          />
        </label>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="px-4 py-2.5 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:text-base-content"
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!reason || busy}
            className="px-6 py-2.5 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? t('report.sending', { defaultValue: 'Sending…' }) : t('report.send', { defaultValue: 'Report' })}
          </button>
        </div>
      </div>
    </Modal>,
    document.body
  )
}
