// AdminLayout — shell for all /admin/* routes.
// Redirects to /login if unauthenticated, and to / if not a server admin.

import { useState, useEffect } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, Users2, Circle,
  Mail, Flag, Settings, ArrowLeft, Palette, BookOpen, Bookmark,
  Menu, X, ScrollText, Compass,
} from 'lucide-react'
import sizedUrl from '../../lib/sizedUrl'

// Ungrouped items (just Dashboard) render with no subtitle above them;
// everything else is grouped under the subtitle the group is keyed by.
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/admin/moderation', label: 'Moderation', icon: Flag },
      { to: '/admin/users',      label: 'Users',      icon: Users },
      { to: '/admin/posts',      label: 'Posts',      icon: FileText },
      { to: '/admin/circles',    label: 'Circles',    icon: Circle },
      { to: '/admin/groups',     label: 'Groups',     icon: Users2 },
    ],
  },
  {
    label: 'Community',
    items: [
      { to: '/admin/discovery', label: 'Discover',  icon: Compass },
      { to: '/admin/pages',     label: 'Pages',      icon: BookOpen },
      { to: '/admin/bookmarks', label: 'Bookmarks',  icon: Bookmark },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/invites',  label: 'Invites',  icon: Mail },
      { to: '/admin/themes',   label: 'Themes',   icon: Palette },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
      { to: '/admin/logs',     label: 'Logs',     icon: ScrollText },
    ],
  },
]

function SidebarContent() {
  const server = useSelector((state) => state.server)
  const user = useSelector((state) => state.auth.user)
  const serverName = server.name || 'Kowloon'
  const avatarUrl = user?.profile?.icon ?? null
  const displayName = user?.profile?.name || user?.username
  const userInitial = user?.username?.[0]?.toUpperCase() ?? '?'

  return (
    <>
      <div className="px-5 pt-6 pb-4 border-b border-secondary-content/20">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-secondary-content/50 hover:text-secondary-content transition-colors mb-3"
        >
          <ArrowLeft size={12} />
          Back to Site
        </Link>
        <p className="font-display text-3xl tracking-widest leading-none truncate">{serverName}</p>
        <p className="font-ui text-xs uppercase tracking-widest opacity-50 mt-1">Control Panel</p>
      </div>

      <nav className="flex flex-col py-2 flex-1" aria-label="Admin navigation">
        {NAV_GROUPS.map(({ label, items }) => (
          <div key={label ?? 'top'}>
            {label && (
              <p className="px-5 pt-4 pb-1 font-ui text-[10px] uppercase tracking-widest text-secondary-content/40">
                {label}
              </p>
            )}
            {items.map(({ to, label: itemLabel, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-2.5 font-ui text-xs uppercase tracking-widest transition-colors ${
                    isActive
                      ? 'bg-secondary-content/15 border-l-2 border-primary text-secondary-content'
                      : 'text-secondary-content/60 hover:text-secondary-content hover:bg-secondary-content/10 border-l-2 border-transparent'
                  }`
                }
              >
                <Icon size={14} aria-hidden="true" />
                {itemLabel}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-5 py-3 border-t border-secondary-content/20">
        <p className="font-ui text-[10px] uppercase tracking-widest text-secondary-content/40 mb-2">
          Logged in as
        </p>
        <div className="flex items-center gap-2.5 mb-3">
          {avatarUrl ? (
            <img src={sizedUrl(avatarUrl, 200)} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="font-display text-sm text-primary-content">{userInitial}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-ui text-sm text-secondary-content truncate">{displayName}</p>
            <p className="font-ui text-[10px] text-secondary-content/50 truncate">{user?.id}</p>
          </div>
        </div>
        <Link
          to="/"
          className="flex items-center gap-2 font-ui text-xs uppercase tracking-widest text-secondary-content/50 hover:text-secondary-content transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Site
        </Link>
      </div>
    </>
  )
}

export default function AdminLayout() {
  const { user, sessionChecked } = useSelector((s) => s.auth)
  const server = useSelector((s) => s.server)
  const serverName = server.name || 'Kowloon'
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Lock body scroll + close on Escape while drawer is open.
  useEffect(() => {
    if (!drawerOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  if (!sessionChecked) return null
  if (!user) return <Navigate to="/login" replace />
  // Non-admins get bounced home rather than an admin shell full of 403s
  // (the server enforces this regardless; isServerAdmin comes from login
  // and /auth/me).
  if (!user.isServerAdmin) return <Navigate to="/" replace />

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-52 shrink-0 bg-secondary text-secondary-content flex-col overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile drawer backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/50 z-[60] lg:hidden transition-opacity duration-200 ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* Mobile drawer panel — slides from the left */}
      <aside
        id="admin-mobile-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        onClick={(e) => { if (e.target.closest('a')) setDrawerOpen(false) }}
        className={`fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-secondary text-secondary-content z-[70] flex flex-col overflow-y-auto lg:hidden transition-transform duration-200 ease-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close sidebar"
          className="absolute top-4 right-4 p-1 text-secondary-content/60 hover:text-secondary-content transition-colors"
        >
          <X size={20} />
        </button>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-base-100">
        {/* Mobile top bar — hamburger + label */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 h-14 bg-secondary text-secondary-content px-4 border-b border-secondary-content/20">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open sidebar"
            aria-expanded={drawerOpen}
            aria-controls="admin-mobile-sidebar"
            className="p-2 -ml-2 text-secondary-content/70 hover:text-secondary-content transition-colors"
          >
            <Menu size={20} />
          </button>
          <p className="font-display text-xl tracking-widest leading-none truncate">{serverName}</p>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1.5 font-ui text-xs uppercase tracking-widest text-secondary-content/60 hover:text-secondary-content transition-colors"
          >
            <ArrowLeft size={12} />
            Site
          </Link>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
