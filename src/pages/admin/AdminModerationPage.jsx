// AdminModerationPage -- reports, plus the server's block lists
// (Blocked, Defederated) and banned emails.

import { useState, useEffect, useCallback } from 'react'
import { ReportsTable } from '../../components/admin/reports'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'
import { BlocklistTab, BannedEmailsTab } from '../../components/admin/blocklists'
import { useStaffRole } from '../../lib/staff'

export default function AdminModerationPage() {
  const client = useClient()
  const isMod = useStaffRole() === 'mod'
  const [tab, setTab] = useState('reports')
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filter, setFilter] = useState('open')

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

  if (denied) return (
    <div className="py-16 text-center"><p className="font-display text-3xl tracking-wide">Access Denied</p></div>
  )

  const FILTERS = [['open', 'Open'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']]

  return (
    <div>
      <div className="flex items-baseline justify-between border-b-2 border-base-300 pb-4 mb-6">
        <h1 className="font-display text-4xl sm:text-5xl tracking-wide">Moderation</h1>
        {tab === 'reports' && (
          <span className="font-ui text-xs uppercase tracking-widest text-base-content/40">{flags.length} items</span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-1 border-b-2 border-base-300 mb-6">
        {[['reports', 'Reports'], ['blocked', 'Blocked'], ['defederated', 'Defederated'], ...(isMod ? [] : [['emails', 'Emails']])].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            className={`pb-3 -mb-0.5 font-display text-base sm:text-xl tracking-wide border-b-2 transition-colors ${
              tab === val ? 'border-primary text-base-content' : 'border-transparent text-base-content/40 hover:text-base-content/70'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'blocked' ? <BlocklistTab key="blocked" client={client} list="blocked" />
        : tab === 'defederated' ? <BlocklistTab key="defederated" client={client} list="defederated" />
        : tab === 'emails' ? <BannedEmailsTab client={client} /> : (
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

      {loading ? <Spinner centered /> : (
        <ReportsTable
          flags={flags}
          showReason
          showStatus={filter !== 'open'}
          empty={filter === 'open' ? 'No open reports -- all clear.' : 'Nothing here.'}
        />
      )}
      </>
      )}
    </div>
  )
}
