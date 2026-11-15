// ContentWarningDialog -- a moderator adds, changes or removes the content
// warning on someone's post. Used from a post's "..." menu (staff only) and
// from a report in the admin panel. The caller does the saving via onSave.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import Modal from './Modal'
import { ContentWarningPicker } from '../posts/ContentWarning'
import { toast } from '../../app/toast'

/**
 * Props:
 *   open, onClose
 *   initial      { contentWarning, sensitive } to start from
 *   onSave       async ({ contentWarning, sensitive }) => void
 *   allowRemove  show "Remove warning" when the post already has one
 *   intro        a line explaining what happens
 *   saveLabel    button text
 */
export default function ContentWarningDialog({ open, ...props }) {
  // Mounted only while open, so each opening starts from `initial`.
  if (!open) return null
  return <ContentWarningDialogBody {...props} />
}

function ContentWarningDialogBody({
  onClose,
  initial,
  onSave,
  allowRemove = false,
  intro = 'Readers will see the warning first and can choose to show the post. The author is told.',
  saveLabel = 'Save warning',
}) {
  const [cw, setCw] = useState(() =>
    initial?.contentWarning
      ? { categories: initial.contentWarning.categories ?? [], note: initial.contentWarning.note ?? '' }
      : null,
  )
  const [sensitive, setSensitive] = useState(!!initial?.sensitive)
  const [busy, setBusy] = useState(false)

  const hasWarning = !!(cw && ((cw.categories?.length ?? 0) > 0 || cw.note))
  const canSave = hasWarning || sensitive

  const run = async (payload) => {
    if (busy) return
    setBusy(true)
    try {
      await onSave(payload)
      setBusy(false)
      onClose()
    } catch (err) {
      toast.error("Couldn't save the warning", { detail: err?.message })
      setBusy(false)
    }
  }

  return createPortal(
    <Modal open onClose={() => !busy && onClose()} title="Content warning">
      <div className="flex flex-col gap-4">
        <p className="font-reading text-sm text-base-content/70">{intro}</p>
        <ContentWarningPicker
          value={cw}
          onChange={setCw}
          sensitive={sensitive}
          onSensitiveChange={setSensitive}
          hasMedia
          defaultOpen
        />
        <div className="flex flex-wrap justify-end gap-3">
          {allowRemove && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run({ contentWarning: null, sensitive: false })}
              className="mr-auto px-4 py-2.5 font-ui text-xs uppercase tracking-widest text-error hover:opacity-80 disabled:opacity-40"
            >
              Remove warning
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:text-base-content"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => run({ contentWarning: hasWarning ? cw : null, sensitive })}
            disabled={!canSave || busy}
            className="px-6 py-2.5 bg-primary text-primary-content font-ui text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving...' : saveLabel}
          </button>
        </div>
      </div>
    </Modal>,
    document.body
  )
}
