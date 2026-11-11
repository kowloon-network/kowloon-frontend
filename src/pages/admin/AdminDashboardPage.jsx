// AdminDashboardPage -- the admin panel's front page, built phone-first
// (most admins run their server from a phone). Order, top to bottom:
//   1. Moderation: open reports, each opening its report page
//   2. Quick actions
//   3. Your community: the four numbers an admin actually watches
//   4. Sections: every admin area with a one-line description (phone/tablet
//      only -- the desktop sidebar already lists them)
//   5. Server health, collapsed: for whoever looks after the machine
//   6. A one-line pointer to the admin guide
// The app's admin home (mobile/app/admin/index.js) follows the same order.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, Bookmark, Mail, Compass, ExternalLink, ChevronRight, AlertTriangle,
  Flag, Users, FileText, Circle, Users2, Palette, Settings, ScrollText,
} from 'lucide-react'
import { useClient } from '../../hooks/useClient'
import Spinner from '../../components/ui/Spinner'
import { ReportsTable } from '../../components/admin/reports'

const REPORTS_SHOWN = 5

const QUICK_ACTIONS = [
  { to: '/admin/invites?new=1',   label: 'Invite',   icon: Mail },
  { to: '/admin/pages?new=1',     label: 'Page',     icon: BookOpen },
  { to: '/admin/bookmarks?new=1', label: 'Bookmark', icon: Bookmark },
]

const SECTIONS = [
  { label: 'Manage', items: [
    { to: '/admin/moderation', label: 'Moderation', desc: 'Reports, and blocking other servers', icon: Flag },
    { to: '/admin/users',      label: 'Users',      desc: 'Find, add, close or restore accounts', icon: Users },
    { to: '/admin/posts',      label: 'Posts',      desc: 'Every post on the server', icon: FileText },
    { to: '/admin/circles',    label: 'Circles',    desc: "Members' circles", icon: Circle },
    { to: '/admin/groups',     label: 'Groups',     desc: 'Groups and who runs them', icon: Users2 },
  ] },
  { label: 'Community', items: [
    { to: '/admin/discovery', label: 'Discover',  desc: 'What newcomers see first', icon: Compass },
    { to: '/admin/pages',     label: 'Pages',     desc: 'About, rules, schedules and the like', icon: BookOpen },
    { to: '/admin/bookmarks', label: 'Bookmarks', desc: "The server's shared links", icon: Bookmark },
  ] },
  { label: 'System', items: [
    { to: '/admin/invites',  label: 'Invites',  desc: 'Links and QR codes for joining', icon: Mail },
    { to: '/admin/themes',   label: 'Themes',   desc: "The server's colours", icon: Palette },
    { to: '/admin/settings', label: 'Settings', desc: 'Name, email, rules, backups', icon: Settings },
    { to: '/admin/logs',     label: 'Logs',     desc: 'Technical errors and warnings', icon: ScrollText },
  ] },
]

function SectionTitle({ children, aside, first = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 border-b-2 border-base-300 pb-2 mb-3 ${first ? '' : 'mt-10'}`}>
      <h2 className="font-display text-2xl tracking-wide">{children}</h2>
      {aside}
    </div>
  )
}

function fmtKb(n) {
  if (n == null) return '--'
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} GB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} MB`
  return `${n} KB`
}

function fmtUptime(s) {
  if (s == null) return '--'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}

function CommunityTile({ label, value, sub, to }) {
  const inner = (
    <>
      <p className="font-display text-3xl sm:text-4xl tracking-wide leading-none tabular-nums">{value ?? '--'}</p>
      <p className="font-ui text-[11px] uppercase tracking-widest text-base-content/50 mt-2">{label}</p>
      {sub && <p className="font-ui text-xs text-base-content/50 mt-0.5">{sub}</p>}
    </>
  )
  const cls = 'bg-base-200 p-4 min-w-0'
  return to
    ? <Link to={to} className={`${cls} block hover:bg-base-300 transition-colors`}>{inner}</Link>
    : <div className={cls}>{inner}</div>
}

function HealthRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-base-300 min-w-0">
      <dt className="font-ui text-xs uppercase tracking-widest text-base-content/50 shrink-0">{label}</dt>
      <dd className="font-ui text-sm tabular-nums text-right truncate">{value ?? '--'}</dd>
    </div>
  )
}

export default function AdminDashboardPage() {
  const client = useClient()
  const [stats, setStats] = useState(null)
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!client) return
    const isDenied = (err) => err?.status === 403 || err?.statusCode === 403
    Promise.all([
      client.admin.serverStats().then(setStats).catch((err) => { if (isDenied(err)) setDenied(true) }),
      client.admin.getFlagged({ status: 'open', limit: REPORTS_SHOWN })
        .then((res) => setReports({ items: res?.orderedItems ?? [], total: res?.totalItems ?? 0 }))
        .catch(() => setReports({ items: [], total: 0, failed: true })),
    ]).finally(() => setLoading(false))
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
  const diskTight = disk?.usedPct != null && disk.usedPct >= 85
  const openTotal = reports?.total ?? c.openFlags ?? 0

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-4xl sm:text-5xl tracking-wide mb-6">Dashboard</h1>

      {diskTight && (
        <Link to="/admin/settings" className="flex items-start gap-3 border-2 border-warning bg-warning/10 px-4 py-3 mb-6">
          <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
          <span className="font-ui text-sm">
            The server's disk is {disk.usedPct}% full. Tell whoever looks after the server before uploads start failing.
          </span>
        </Link>
      )}

      {/* 1. Moderation */}
      <SectionTitle
        first
        aside={openTotal > 0 && (
          <Link to="/admin/moderation" className="font-ui text-xs uppercase tracking-widest text-primary hover:underline whitespace-nowrap">
            {openTotal > REPORTS_SHOWN ? `All ${openTotal} open` : 'Moderation'}
          </Link>
        )}
      >
        Moderation
      </SectionTitle>
      {reports?.failed
        ? <p className="font-ui text-sm text-error py-3">Couldn't load reports. <Link to="/admin/moderation" className="underline">Open Moderation</Link></p>
        : <ReportsTable flags={reports?.items ?? []} empty="No open reports." />}

      {/* 2. Quick actions */}
      <SectionTitle>Create new</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2 py-3 border-2 border-base-300 hover:border-primary hover:text-primary transition-colors font-ui text-[11px] sm:text-xs uppercase tracking-widest text-base-content/70 text-center"
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </div>

      {/* 3. Your community */}
      <SectionTitle>Your community</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <CommunityTile label="Members" value={c.users} sub={a.newUsersWeek != null ? `${a.newUsersWeek} new this week` : null} to="/admin/users" />
        <CommunityTile label="Posts today" value={a.postsToday} sub={c.posts != null ? `${c.posts} in all` : null} to="/admin/posts" />
        <CommunityTile label="Groups" value={c.groups} to="/admin/groups" />
        <CommunityTile label="Invites" value={c.activeInvites} sub={a.invitesUsed != null ? `active -- ${a.invitesUsed} used` : 'active'} to="/admin/invites" />
      </div>

      {/* 4. Sections -- the desktop sidebar already lists these */}
      <div className="lg:hidden">
        {SECTIONS.map((group) => (
          <div key={group.label}>
            <SectionTitle>{group.label}</SectionTitle>
            <div className="border-t border-base-300">
              {group.items.map(({ to, label, desc, icon: Icon }) => (
                <Link key={to} to={to} className="group flex items-center gap-3 py-3 border-b border-base-300 hover:bg-base-200 transition-colors">
                  <Icon size={18} className="text-base-content/50 group-hover:text-primary shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-ui text-sm font-medium">{label}</span>
                    <span className="block font-ui text-xs text-base-content/50 truncate">{desc}</span>
                  </span>
                  <ChevronRight size={16} className="text-base-content/30 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 5. Server health, collapsed */}
      <details className="group mt-10 border-2 border-base-300">
        <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-base-200">
          <span>
            <span className="block font-display text-xl tracking-wide">Server health</span>
            <span className="block font-ui text-xs text-base-content/50">
              {disk ? `Disk ${disk.usedPct}% used` : 'Storage'} -- up {fmtUptime(srv.uptimeSeconds)}
            </span>
          </span>
          <ChevronRight size={18} className="text-base-content/40 transition-transform group-open:rotate-90" />
        </summary>
        <div className="px-4 pb-4 grid sm:grid-cols-2 gap-x-8">
          <dl>
            <p className="font-ui text-[11px] uppercase tracking-widest text-base-content/40 mt-3 mb-1">Storage</p>
            {disk && <HealthRow label="Disk" value={`${fmtKb(disk.usedKb)} of ${fmtKb(disk.totalKb)} (${disk.usedPct}%)`} />}
            <HealthRow label="Media" value={`${m.totalFiles ?? '--'} files, ${fmtKb(m.totalSizeKb)}`} />
            <HealthRow label="Photos / videos" value={`${m.photos ?? '--'} / ${m.videos ?? '--'}`} />
            <HealthRow label="Audio / documents" value={`${m.audio ?? '--'} / ${m.documents ?? '--'}`} />
            <HealthRow label="Database" value={fmtKb(db.storageKb)} />
          </dl>
          <dl>
            <p className="font-ui text-[11px] uppercase tracking-widest text-base-content/40 mt-3 mb-1">Machine</p>
            <HealthRow label="Uptime" value={fmtUptime(srv.uptimeSeconds)} />
            <HealthRow label="Memory free" value={srv.memoryMb ? `${srv.memoryMb.free} of ${srv.memoryMb.total} MB` : null} />
            <HealthRow label="Server process" value={srv.memoryMb?.processHeap != null ? `${srv.memoryMb.processHeap} MB` : null} />
            <HealthRow label="Node" value={srv.nodeVersion} />
            <HealthRow label="Platform" value={srv.platform ? `${srv.platform}/${srv.arch}` : null} />
          </dl>
          <dl className="sm:col-span-2">
            <p className="font-ui text-[11px] uppercase tracking-widest text-base-content/40 mt-3 mb-1">Totals</p>
            <div className="grid sm:grid-cols-2 gap-x-8">
              <HealthRow label="Replies" value={c.replies} />
              <HealthRow label="Reactions" value={c.reacts} />
              <HealthRow label="Pages" value={c.pages} />
              <HealthRow label="New members (month / year)" value={`${a.newUsersMonth ?? '--'} / ${a.newUsersYear ?? '--'}`} />
            </div>
          </dl>
        </div>
      </details>

      {/* 6. Guide */}
      <a
        href="https://kowloon.network/docs/admin/quick-start/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-8 mb-4 font-ui text-xs uppercase tracking-widest text-base-content/60 hover:text-primary transition-colors"
      >
        <Compass size={14} className="shrink-0" />
        New to running a server? Read the guide
        <ExternalLink size={12} className="shrink-0" />
      </a>
    </div>
  )
}
