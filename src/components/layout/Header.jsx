import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { X, Search, Menu } from 'lucide-react'
import { logoutAsync } from '../../features/auth/authSlice'
import { useClient } from '../../hooks/useClient'
import useFitText from '../../hooks/useFitText'
import sizedUrl from '../../lib/sizedUrl'
import Sidebar from './Sidebar'

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

const navLinkClass = ({ isActive }) =>
  `flex items-center h-full px-5 font-ui text-xs uppercase tracking-widest transition-colors ${
    isActive
      ? 'text-base-content border-b-4 border-primary'
      : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
  }`

export function Header() {
  const dispatch   = useDispatch()
  const navigate   = useNavigate()
  const { user }   = useSelector((state) => state.auth)
  const server     = useSelector((state) => state.server)
  const client     = useClient()
  const { t }      = useTranslation()

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [unreadCount, setUnreadCount]   = useState(0)

  const serverName = server.name || 'Kowloon'
  const [mobileTitleRef,  mobileTitleWrap]  = useFitText({ maxPx: 18, wrapPx: 13, text: serverName })
  const [desktopTitleRef, desktopTitleWrap] = useFitText({ maxPx: 22, wrapPx: 16, text: serverName })
  const [drawerTitleRef,  drawerTitleWrap]  = useFitText({ maxPx: 18, wrapPx: 14, text: serverName })

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

  // Poll unread notification count every 60s
  useEffect(() => {
    if (!client || !user) return
    const poll = () => client.notifications.unreadCount().then((res) => setUnreadCount(res?.count ?? 0)).catch(() => {})
    poll()
    const id = setInterval(poll, 60_000)
    return () => clearInterval(id)
  }, [client, user])

  // Live badge sync — NotificationsPage emits this on mark-read/dismiss/mark-all
  // so the count updates instantly instead of waiting for the next 60s poll.
  useEffect(() => {
    const onUnread = (e) => setUnreadCount(e.detail?.count ?? 0)
    window.addEventListener('kowloon:unread', onUnread)
    return () => window.removeEventListener('kowloon:unread', onUnread)
  }, [])

  const NAV_LINKS = [
    { to: '/',          label: t('nav.feed')     },
    { to: '/circles',   label: t('nav.circles')  },
    { to: '/groups',    label: t('nav.groups')   },
    { to: '/discover',  label: t('nav.discover') },
    { to: '/servers',   label: t('nav.servers', { defaultValue: 'Servers' }) },
    { to: '/search',    label: t('nav.search')   },
  ]

  const handleLogout = async () => {
    await dispatch(logoutAsync())
    navigate('/')
  }

  const avatarUrl   = user?.profile?.icon ?? null
  const userHandle  = user?.id || user?.username
  const userInitial = user?.username?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="bg-base-100 border-b border-base-300 sticky top-0 z-50">
      <nav className="flex items-stretch h-16">

        {/* ── Logo ── desktop: home link; mobile: drawer trigger */}
        {(() => {
          const titleClass = (wrapped) =>
            `font-display text-base-content min-w-0 text-left ${
              wrapped ? 'line-clamp-2 leading-[1.1]' : 'truncate'
            }`
          const titleStyle = (wrapped, wrapPx, maxPx) => ({
            fontSize: wrapped ? `${wrapPx}px` : `${maxPx}px`,
          })
          const logoClass = 'flex items-center gap-3 pl-4 pr-3 min-w-0 hover:opacity-90 transition-opacity'
          const Icon = (
            <img
              className="h-9 w-9 object-contain shrink-0"
              src={server.icon ? sizedUrl(server.icon, 200) : '/logo.png'}
              alt={serverName}
              onError={(e) => { e.currentTarget.src = '/logo.png' }}
            />
          )
          return (
            <>
              <div className="lg:hidden flex items-center gap-2 pl-3 pr-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label={t('a11y.openSidebar', { defaultValue: 'Open sidebar' })}
                  aria-expanded={drawerOpen}
                  aria-controls="mobile-sidebar-drawer"
                  className="shrink-0 p-1 -ml-1 text-base-content/85 hover:text-base-content transition-colors"
                >
                  <Menu size={24} />
                </button>
                <Link to="/" className="shrink-0 hover:opacity-90 transition-opacity">
                  {Icon}
                </Link>
                <Link to="/" className="min-w-0 hover:opacity-90 transition-opacity">
                  <span
                    ref={mobileTitleRef}
                    className={titleClass(mobileTitleWrap)}
                    style={titleStyle(mobileTitleWrap, 13, 18)}
                  >
                    {serverName}
                  </span>
                </Link>
              </div>
              <Link
                to="/"
                className={`hidden lg:flex ${logoClass}`}
              >
                {Icon}
                <span
                  ref={desktopTitleRef}
                  className={titleClass(desktopTitleWrap)}
                  style={titleStyle(desktopTitleWrap, 16, 22)}
                >
                  {serverName}
                </span>
              </Link>
            </>
          )
        })()}

        {/* ── Desktop nav ──────────────────────────────────────── */}
        <ul className="hidden lg:flex items-stretch ml-2">
          {NAV_LINKS.map(({ to, label }) => (
            <li key={to} className="flex items-stretch">
              <NavLink to={to} end={to === '/'} className={navLinkClass}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* ── Right side ───────────────────────────────────────── */}
        <div className="flex items-center gap-1 ml-auto px-3">

          {/* Search — mobile only, when signed in (desktop reaches it via the top
              nav; signed-out mobile keeps the header uncluttered). */}
          {user && (
            <Link
              to="/search"
              aria-label={t('nav.search')}
              className="lg:hidden flex items-center justify-center w-10 h-10 text-base-content/80 hover:text-base-content transition-colors"
            >
              <Search size={20} />
            </Link>
          )}

          {/* Notifications bell — desktop only (mobile uses the bottom tab) */}
          {user && (
            <>
              {/* Persistent live region — always in DOM so screen readers catch count changes */}
              <span
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
              >
                {unreadCount > 0
                  ? t('a11y.notificationCount', { count: unreadCount, defaultValue: `${unreadCount} unread notifications` })
                  : ''}
              </span>

              <Link
                to="/notifications"
                aria-label={t('a11y.notifications', { defaultValue: 'Notifications' })}
                className="hidden lg:flex items-center justify-center w-10 h-10 text-base-content/70 hover:text-primary transition-colors"
              >
                <div className="indicator">
                  <BellIcon />
                  {unreadCount > 0 && (
                    <span aria-hidden="true" className="indicator-item badge bg-primary text-primary-content border-0 font-ui text-[10px] min-w-[1.1rem] h-[1.1rem] px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            </>
          )}

          {/* User menu */}
          {user ? (
            <div className="dropdown dropdown-end">
              <button
                tabIndex={0}
                aria-label={t('a11y.userMenu')}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                onClick={() => setUserMenuOpen((o) => !o)}
                onBlur={() => setTimeout(() => setUserMenuOpen(false), 150)}
                className="flex items-center gap-3 px-3 h-10 text-base-content/70 hover:text-primary hover:bg-base-200 transition-colors"
              >
                {avatarUrl ? (
                  <img src={sizedUrl(avatarUrl, 200)} alt={userHandle} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                    <span className="font-display text-sm text-primary-content">{userInitial}</span>
                  </div>
                )}
                <span className="font-ui text-xs uppercase tracking-widest hidden xl:block">
                  {user?.username}
                </span>
              </button>
              <ul
                role="menu"
                tabIndex={0}
                className="dropdown-content p-0 mt-0 bg-base-100 dark:bg-neutral w-48 border-t-4 border-primary z-[1]"
              >
                <li className="px-4 py-3 font-ui text-xs uppercase tracking-widest text-base-content/40 dark:text-white/60 border-b border-base-300 dark:border-white/10 truncate">
                  {userHandle}
                </li>
                <li>
                  {/* #67: "Profile & Settings" below is the EDIT form
                      (ProfilePage.jsx) -- it never shows what a stranger
                      actually sees. This is the one link to that public
                      view, same /users/:id route anyone else's profile
                      link points at. */}
                  <Link to={`/users/${encodeURIComponent(userHandle)}`} className="block px-4 py-3 font-ui text-xs uppercase tracking-widest text-base-content/70 dark:text-white/95 hover:text-primary hover:bg-base-200 dark:hover:bg-base-200 transition-colors">
                    {t('nav.viewProfile', { defaultValue: 'View Profile' })}
                  </Link>
                </li>
                <li>
                  <Link to="/profile" className="block px-4 py-3 font-ui text-xs uppercase tracking-widest text-base-content/70 dark:text-white/95 hover:text-primary hover:bg-base-200 dark:hover:bg-base-200 transition-colors">
                    {t('nav.profile')}
                  </Link>
                </li>
                <li>
                  <Link to={`/users/${encodeURIComponent(userHandle)}/circles`} className="block px-4 py-3 font-ui text-xs uppercase tracking-widest text-base-content/70 dark:text-white/95 hover:text-primary hover:bg-base-200 dark:hover:bg-base-200 transition-colors">
                    {t('nav.myCircles', { defaultValue: 'My Circles' })}
                  </Link>
                </li>
                {user?.isServerAdmin && (
                  <li>
                    <Link to="/admin" className="block px-4 py-3 font-ui text-xs uppercase tracking-widest text-base-content/70 dark:text-white/95 hover:text-primary hover:bg-base-200 dark:hover:bg-base-200 transition-colors">
                      {t('nav.admin', { defaultValue: 'Admin' })}
                    </Link>
                  </li>
                )}
                <li>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 font-ui text-xs uppercase tracking-widest text-base-content/70 dark:text-white/95 hover:text-primary hover:bg-base-200 dark:hover:bg-base-200 transition-colors"
                  >
                    {t('nav.logout')}
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            /* Logged-out: sign in / register — shown at all widths */
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/login"
                className="px-2.5 sm:px-4 py-2 font-ui text-xs uppercase tracking-widest whitespace-nowrap text-base-content/80 hover:text-base-content transition-colors"
              >
                {t('nav.signIn')}
              </Link>
              <Link
                to="/register"
                className="px-2.5 sm:px-4 py-2 font-ui text-xs uppercase tracking-widest whitespace-nowrap bg-primary text-primary-content hover:opacity-90 transition-colors"
              >
                {t('nav.register')}
              </Link>
            </div>
          )}

        </div>
      </nav>

      {/* ── Mobile sidebar drawer ─────────────────────────────── */}
      {/* Backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/50 z-[60] lg:hidden transition-opacity duration-200 ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* Drawer panel — slides from the left */}
      <aside
        id="mobile-sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('a11y.sidebar', { defaultValue: 'Sidebar' })}
        // Close drawer when any link inside is clicked (event bubbles up)
        onClick={(e) => { if (e.target.closest('a')) setDrawerOpen(false) }}
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-base-100 z-[70] overflow-y-auto lg:hidden transition-transform duration-200 ease-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 h-16 bg-base-100 border-b border-base-300 px-4">
          <Link to="/" className="min-w-0 hover:opacity-90 transition-opacity">
            <span
              ref={drawerTitleRef}
              className={`font-display text-base-content min-w-0 text-left ${
                drawerTitleWrap ? 'line-clamp-2 leading-[1.1]' : 'truncate'
              }`}
              style={{ fontSize: drawerTitleWrap ? '14px' : '18px' }}
            >
              {serverName}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label={t('a11y.closeSidebar', { defaultValue: 'Close sidebar' })}
            className="p-2 -mr-2 text-base-content/70 hover:text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <Sidebar />
        </div>
      </aside>
    </header>
  )
}
