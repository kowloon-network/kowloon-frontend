// NewCircleModal — single-step circle creation dialog.
// Wraps the shared CircleForm so the modal stays in lockstep with the
// full-page New Circle flow (icon upload, click-row-to-add, etc).
//
// Props:
//   onClose()           — close without creating
//   onCreated(circleId) — called after circle (and optional members) created

import { useEffect, useRef } from 'react'
import FocusTrap from 'focus-trap-react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import { fetchMyCircles } from '../../features/circles/myCirclesSlice'
import CircleForm from './CircleForm'
import { useState } from 'react'

export default function NewCircleModal({ onClose, onCreated }) {
  const client = useClient()
  const dispatch = useDispatch()
  const { t } = useTranslation()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const panelRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async ({ name, description, to, iconFile, iconUrl, members }) => {
    setSubmitting(true)
    setError(null)
    try {
      // 1. Upload icon if a new file was selected
      let finalIconUrl = iconFile ? null : (iconUrl ?? null)
      if (iconFile) {
        const uploaded = await client.files.upload({
          file: iconFile,
          filename: iconFile.name,
          contentType: iconFile.type,
          to: '@public',
        })
        if (uploaded?.file?.url) finalIconUrl = uploaded.file.url
      }

      // 2. Create the circle
      const res = await client.activities.createCircle({
        name,
        description: description || undefined,
        icon: finalIconUrl ?? undefined,
        to,
      })

      const circleId = res?.createdId ?? res?.activity?.objectId ?? res?.result?.id
      if (!circleId) throw new Error('Circle created but ID not returned')

      // 3. Batch-add members
      if (members.length > 0) {
        await client.activities.addToCircle({ circleId, members })
      }

      dispatch(fetchMyCircles())
      onCreated?.(circleId)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create circle.')
      setSubmitting(false)
    }
  }

  // Focus trap: focus starts in the name field and returns to the opener on
  // close. Escape is handled by the keydown listener above.
  return (
    <FocusTrap
      focusTrapOptions={{
        escapeDeactivates: false,
        allowOutsideClick: true,
        initialFocus: () => panelRef.current?.querySelector('input, textarea') ?? panelRef.current,
        fallbackFocus: () => panelRef.current,
        returnFocusOnDeactivate: true,
      }}
    >
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-base-content/30 overflow-y-auto py-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('circle.newTitle', { defaultValue: 'New Circle' })}
        className="relative w-full max-w-2xl bg-base-100 border-2 border-base-300 shadow-xl mx-4 my-auto"
      >

        {/* Header — modal owns the title, form is rendered embedded */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-base-300">
          <h2 className="font-display text-3xl leading-none tracking-wide">
            {t('circle.newTitle', { defaultValue: 'New Circle' })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Close' })}
            className="text-base-content/40 hover:text-base-content transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6">
          <CircleForm
            mode="create"
            embedded
            onSubmit={handleSubmit}
            onCancel={onClose}
            submitting={submitting}
            error={error}
          />
        </div>

      </div>
    </div>
    </FocusTrap>
  )
}
