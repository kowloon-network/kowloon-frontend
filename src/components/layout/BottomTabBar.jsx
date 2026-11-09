// BottomTabBar — app-style primary navigation for phone-width viewports.
// Mirrors the mobile app's bottom bar (see mobile/src/components/nav/BottomTabBar.jsx):
// five destinations — Feed · Circles · Groups · Discover · Notify — with the unread
// badge on Notify. Hidden at lg+ where the desktop 3-column layout + top nav take over.
//
// Rendered as a non-fixed flex child at the bottom of the layout's flex column, so it
// sits below the internally-scrolling <main> without needing fixed positioning or
// content padding. Search lives as a button in the header (matching the app).

import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Home, Hexagon, Users, Compass, Bell } from 'lucide-react'
import { useNotificationPoll } from '../../hooks/useNotificationPoll'

const TABS = [
  { to: '/',          key: 'feed',      Icon: Home,    end: true  },
  { to: '/circles',   key: 'circles',   Icon: Hexagon, end: false },
  { to: '/groups',    key: 'groups',    Icon: Users,   end: false },
  { to: '/discover',  key: 'discover',  Icon: Compass, end: false },
  { to: '/notifications', key: 'notifications', Icon: Bell, end: false, badge: true },
]

export default function BottomTabBar() {
  const user = useSelector((state) => state.auth.user)
  const { t } = useTranslation()
  // Shared with the header bell -- one request per minute, paused in hidden tabs.
  const { count: polledCount } = useNotificationPoll()
  const unreadCount = user ? polledCount : 0

  const label = (key) =>
    t(`nav.${key === 'notifications' ? 'notifyShort' : key}`, {
      defaultValue: { feed: 'Feeds', circles: 'Circles', groups: 'Groups', discover: 'Discover', notifications: 'Notify' }[key],
    })

  return (
    <nav
      aria-label={t('a11y.primary', { defaultValue: 'Primary' })}
      className="lg:hidden shrink-0 bg-base-100 border-t-2 border-base-300 pb-safe-standalone"
    >
      <ul className="flex">
        {TABS.map(({ to, key, Icon, end, badge }) => (
          <li key={key} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center pt-2 pb-1 transition-colors ${
                  isActive ? 'text-primary' : 'text-base-content/50 hover:text-base-content'
                }`
              }
            >
              <span className="relative">
                <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                {badge && user && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-accent text-accent-content min-w-[16px] h-4 px-1 flex items-center justify-center font-ui text-[9px] font-bold leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
              <span className="font-ui uppercase tracking-[0.12em] text-[10px] mt-1">
                {label(key)}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
