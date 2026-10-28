// Protected layout — redirects to /login if not authenticated.
// Shows a loading spinner while the session restore is in flight.

import AppErrorBoundary from '../ui/AppErrorBoundary'
import { Outlet, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Header } from './Header'
import Sidebar from './Sidebar'
import RightSidebar from './RightSidebar'
import BottomTabBar from './BottomTabBar'
import Footer from './Footer'

export default function Layout() {
  const { user, sessionChecked } = useSelector((state) => state.auth)
  // Must run before the early returns below — a hook called only on some
  // renders (e.g. once sessionChecked/user become truthy) trips React's
  // "Rendered more hooks than during the previous render" (#310), which
  // crashed every protected route once the session finished restoring.
  const { t } = useTranslation()

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="h-[100svh] flex flex-col bg-base-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-content focus:font-ui focus:text-xs focus:uppercase focus:tracking-widest"
      >
        {t('a11y.skipToContent')}
      </a>
      <Header />
      <div className="flex-1 overflow-hidden lg:px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 h-full">
          <div className="hidden lg:block lg:col-span-3 overflow-y-auto py-6"><Sidebar /></div>
          <main id="main-content" className="col-span-1 lg:col-span-6 px-5 lg:px-8 overflow-y-auto py-5 lg:py-6"><AppErrorBoundary><Outlet /></AppErrorBoundary><Footer /></main>
          <div className="hidden lg:block lg:col-span-3 overflow-y-auto py-6"><RightSidebar /></div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  )
}
