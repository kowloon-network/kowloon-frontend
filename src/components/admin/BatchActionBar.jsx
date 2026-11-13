import { Trash2, Flame, RotateCcw, X } from 'lucide-react'

export default function BatchActionBar({ count, filter, onSoftDelete, onHardDelete, onRestore, onClear, busy }) {
  if (count === 0) return null

  // A handler left out hides its button (moderators can't delete content).
  const canDelete = filter !== 'deleted' && !!onSoftDelete
  const canRestore = filter === 'deleted'

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-secondary text-secondary-content mb-4">
      <span className="font-ui text-xs uppercase tracking-widest font-bold">
        {count} selected
      </span>
      <div className="flex gap-0 ml-2">
        {canDelete && (
          <button
            onClick={onSoftDelete}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 font-ui text-xs uppercase tracking-widest bg-secondary-content/10 hover:bg-secondary-content/20 transition-colors disabled:opacity-40"
            title="Soft delete (recoverable)"
          >
            <Trash2 size={12} /> Delete
          </button>
        )}
        {onHardDelete && (
        <button
          onClick={onHardDelete}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 font-ui text-xs uppercase tracking-widest bg-error/20 hover:bg-error/30 text-error-content transition-colors disabled:opacity-40"
          title="Permanently delete — cannot be undone"
        >
          <Flame size={12} /> Hard Delete
        </button>
        )}
        {canRestore && (
          <button
            onClick={onRestore}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 font-ui text-xs uppercase tracking-widest bg-secondary-content/10 hover:bg-secondary-content/20 transition-colors disabled:opacity-40"
          >
            <RotateCcw size={12} /> Restore
          </button>
        )}
      </div>
      <button
        onClick={onClear}
        className="ml-auto p-1 opacity-60 hover:opacity-100 transition-opacity"
        title="Clear selection"
      >
        <X size={14} />
      </button>
    </div>
  )
}
