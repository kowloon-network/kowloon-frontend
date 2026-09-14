// AdminDashboardPage — server stats overview.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, BookOpen, Bookmark, Mail, Compass, ExternalLink } from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'

const QUICK_LINKS = [
  { to: '/admin/pages?new=1',     label: 'Create Page',     icon: BookOpen },
  { to: '/admin/bookmarks?new=1', label: 'Create Bookmark', icon: Bookmark },
  { to: '/admin/invites?new=1',   label: 'Create Invite',   icon: Mail },
]

function QuickLinks() {
  return (
    <div className="flex flex-wrap gap-3 mb-8">
      {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-base-300 hover:border-primary hover:text-primary transition-colors font-ui text-xs uppercase tracking-widest text-base-content/70"
        >
          <Plus size={13} />
          <Icon size={14} />
          {label}
        </Link>
      ))}
    </div>
  )
}

// Sits directly under the quick links, above the stats. A new admin's first
// view of this page is a wall of numbers that assumes they already know what
// the job is; this is the one thing on the dashboard aimed at someone who
// doesn't yet. Opens in a new tab so it never navigates them out of the
// panel they're learning.
function GuideBanner() {
  return (
    <a
      href="https://kowloon.network/docs/admin/quick-start/"
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 border-2 border-primary bg-primary/5 hover:bg-primary/10 px-5 py-4 mb-8 transition-colors"
    >
      <Compass size={22} className="text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-display text-xl tracking-wide">New to running a server?</p>
        <p className="font-reading text-sm text-base-content/60">
          A short guide to everything on this panel -- appearance, invites, rules,
          pages and moderation.
        </p>
      </div>
      <span className="flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-primary shrink-0">
        Read the guide
        <ExternalLink size={13} className="group-hover:translate-x-0.5 transition-transform" />
      </span>
    </a>
  )
}

function StatCard({ label, value, sub, to }) {
  const inner = (
    <>
      <p className="font-display text-4xl tracking-wide leading-none">{value ?? '—'}</p>
      <p className="font-ui text-xs uppercase tracking-widest text-base-content/50 mt-1">{label}</p>
      {sub && <p className="font-ui text-xs text-base-content/40 mt-0.5">{sub}</p>}
    </>
  )
  return to
    ? <Link to={to} className="bg-base-200 p-5 block hover:bg-base-300 transition-colors">{inner}</Link>
    : <div className="bg-base-200 p-5">{inner}</div>
}

function SectionTitle({ children }) {
  return (
    <h2 className="font-display text-2xl tracking-wide border-b-2 border-base-300 pb-2 mt-8 mb-4 first:mt-0">
      {children}
    </h2>
  )
}

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} GB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} MB`
  return `${n} KB`
}

function fmtUptime(s) {
  if (s == null) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const parts = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

export default function AdminDashboardPage() {
  const client = useClient()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!client) return
    client.admin.serverStats()
      .then(setStats)
      .catch((err) => {
        if (err?.status === 403 || err?.statusCode === 403) setDenied(true)
      })
      .finally(() => setLoading(false))
  }, [client])

  if (loading) return <Spinner centered />

  if (denied) return (
    <div className="py-16 text-center">
      <p className="font-display text-3xl tracking-wide">Access Denied</p>
      <p className="font-ui text-sm uppercase tracking-widest text-base-content/50 mt-2">
        You are not a server administrator.
      </p>
    </div>
  )

  const c = stats?.counts ?? {}
  const a = stats?.activity ?? {}
  const m = stats?.media ?? {}
  const srv = stats?.server ?? {}
  const db = stats?.database ?? {}
  const disk = stats?.disk ?? null

  return (
    <div>
      <h1 className="font-display text-5xl tracking-wide mb-8">Dashboard</h1>

      <QuickLinks />

      <GuideBanner />

      <SectionTitle>Activity</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Posts Today"        value={a.postsToday} />
        <StatCard label="New Users (Week)"   value={a.newUsersWeek} />
        <StatCard label="New Users (Month)"  value={a.newUsersMonth} />
        <StatCard label="New Users (Year)"   value={a.newUsersYear} />
        <StatCard label="Invites Used"       value={a.invitesUsed} />
      </div>

      <SectionTitle>Content</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Users"          value={c.users}        to="/admin/users" />
        <StatCard label="Posts"          value={c.posts}        to="/admin/posts" />
        <StatCard label="Replies"        value={c.replies} />
        <StatCard label="Groups"         value={c.groups}       to="/admin/groups" />
        <StatCard label="Circles"        value={c.circles}      to="/admin/circles" />
        <StatCard label="Pages"          value={c.pages} />
        <StatCard label="Reacts"         value={c.reacts} />
        <StatCard label="Open Flags"     value={c.openFlags}    sub="moderation queue" to="/admin/moderation" />
        <StatCard label="Active Invites" value={c.activeInvites} to="/admin/invites" />
        <StatCard label="Activities"     value={c.activities} />
      </div>

      <SectionTitle>Media</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total Files" value={m.totalFiles} />
        <StatCard label="Photos"      value={m.photos} />
        <StatCard label="Videos"      value={m.videos} />
        <StatCard label="Audio"       value={m.audio} />
        <StatCard label="Documents"   value={m.documents} />
        <StatCard label="Total Size"  value={fmt(m.totalSizeKb)} />
      </div>

      <SectionTitle>Server</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Node"    value={srv.nodeVersion} />
        <StatCard label="Platform" value={srv.platform ? `${srv.platform}/${srv.arch}` : '—'} />
        <StatCard label="Uptime"  value={fmtUptime(srv.uptimeSeconds)} />
        <StatCard label="Total Memory"   value={srv.memoryMb?.total != null ? `${srv.memoryMb.total} MB` : '—'} />
        <StatCard label="Free Memory"    value={srv.memoryMb?.free  != null ? `${srv.memoryMb.free} MB` : '—'} />
        <StatCard label="Process Heap"   value={srv.memoryMb?.processHeap != null ? `${srv.memoryMb.processHeap} MB` : '—'} />
      </div>

      <SectionTitle>Database</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="DB Name"   value={db.name} />
        <StatCard label="Data"      value={fmt(db.dataKb)} />
        <StatCard label="Storage"   value={fmt(db.storageKb)} />
        <StatCard label="Indexes"   value={fmt(db.indexKb)} />
        <StatCard label="Objects"   value={db.objects} />
        <StatCard label="Collections" value={db.collections} />
      </div>

      {disk && (
        <>
          <SectionTitle>Disk</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Used"  value={fmt(disk.usedKb)}  sub={`${disk.usedPct}%`} />
            <StatCard label="Free"  value={fmt(disk.freeKb)} />
            <StatCard label="Total" value={fmt(disk.totalKb)} />
          </div>
        </>
      )}
    </div>
  )
}
