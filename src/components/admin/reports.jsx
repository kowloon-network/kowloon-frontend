// Shared pieces for showing moderation reports (Flags): the dashboard's
// open-reports table, the Moderation list, and the single-report page.
//
// The server enriches each flag with targetSummary {title, excerpt, removed},
// targetActor {id, name} and reporter {id, name} -- see
// server/routes/admin/flagged.js enrichFlag().

import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { fmtDate, reasonLabel, reportPath, targetLabel, personName, TYPE_LABELS } from './reportUtils'

export function StatusChip({ status }) {
  return (
    <span className={`font-ui text-[10px] uppercase tracking-widest px-2 py-0.5 whitespace-nowrap ${
      status === 'open' ? 'bg-warning/15 text-warning' :
      status === 'resolved' ? 'bg-success/15 text-success' :
      'bg-base-300 text-base-content/50'
    }`}>
      {status}
    </span>
  )
}

// One table for every list of reports. On a phone each report is a stacked
// row (what was reported, then "by author -- reported by reporter"); from
// `sm` up it's a real table. Every row opens the report page.
export function ReportsTable({ flags, showReason = false, showStatus = false, empty = 'No open reports.' }) {
  if (!flags.length) {
    return (
      <p className="py-6 text-center font-ui text-xs uppercase tracking-widest text-base-content/40 border-y border-base-300">
        {empty}
      </p>
    )
  }
  return (
    <div className="border-t-2 border-base-300">
      {/* Header row: only from sm up */}
      <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 py-2 border-b border-base-300 font-ui text-xs uppercase tracking-widest text-base-content/50">
        <span>Reported</span>
        <span>Author</span>
        <span>Reporter</span>
        <span className="w-4" />
      </div>
      {flags.map((flag) => (
        <Link
          key={flag.id}
          to={reportPath(flag)}
          className="group grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-center py-3 border-b border-base-300 hover:bg-base-200 transition-colors"
        >
          <div className="min-w-0">
            <p className={`font-reading text-base leading-snug truncate ${flag.targetSummary?.removed ? 'line-through text-base-content/50' : ''}`}>
              {targetLabel(flag)}
            </p>
            <p className="font-ui text-[11px] uppercase tracking-widest text-base-content/40 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{TYPE_LABELS[flag.targetType] || flag.targetType || 'Item'}</span>
              {showReason && <span>-- {reasonLabel(flag.reason)}</span>}
              <span className="normal-case tracking-normal">{fmtDate(flag.createdAt)}</span>
              {showStatus && <StatusChip status={flag.status} />}
            </p>
            {/* Names under the title on a phone */}
            <p className="sm:hidden font-ui text-xs text-base-content/60 mt-1 truncate">
              by {personName(flag.targetActor, flag.targetActorId)}
              <span className="text-base-content/40"> -- reported by </span>
              {personName(flag.reporter, flag.actorId)}
            </p>
          </div>
          <span className="hidden sm:block font-ui text-sm truncate">{personName(flag.targetActor, flag.targetActorId)}</span>
          <span className="hidden sm:block font-ui text-sm truncate text-base-content/70">{personName(flag.reporter, flag.actorId)}</span>
          <ChevronRight size={16} className="text-base-content/30 group-hover:text-primary transition-colors" />
        </Link>
      ))}
    </div>
  )
}
