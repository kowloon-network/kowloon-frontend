import { createBrowserRouter } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import PublicLayout from '../components/layout/PublicLayout'

// Public pages (accessible with or without auth)
import HomePage from '../pages/HomePage'
import PostsPage from '../pages/PostsPage'
import PostPage from '../pages/PostPage'
import UsersPage from '../pages/UsersPage'
import UserPage from '../pages/UserPage'
import UserPostsPage from '../pages/UserPostsPage'
import UserCirclesPage from '../pages/UserCirclesPage'
import UserBookmarksPage from '../pages/UserBookmarksPage'
import GroupsPage from '../pages/GroupsPage'
import GroupPage from '../pages/GroupPage'
import GroupPostsPage from '../pages/GroupPostsPage'
import CirclesPage from '../pages/CirclesPage'
import CirclePage from '../pages/CirclePage'
import CirclePostsPage from '../pages/CirclePostsPage'
import PagesListPage from '../pages/PagesListPage'
import PageDetailPage from '../pages/PageDetailPage'
import SearchPage from '../pages/SearchPage'
import DiscoverPage from '../pages/DiscoverPage'
import ServersPage from '../pages/ServersPage'

// Protected pages (auth required — Layout redirects to /login)
import NewPostPage from '../pages/NewPostPage'
import EditPostPage from '../pages/EditPostPage'
import NewGroupPage from '../pages/NewGroupPage'
import EditGroupPage from '../pages/EditGroupPage'
import GroupPendingPage from '../pages/GroupPendingPage'
import ServerPage from '../pages/ServerPage'
import NewCirclePage from '../pages/NewCirclePage'
import EditCirclePage from '../pages/EditCirclePage'
import NotificationsPage from '../pages/NotificationsPage'
import ProfilePage from '../pages/ProfilePage'

// Code-split routes: admin, auth/oauth pages (LoginPage/RegisterPage pull in
// the ~765KB AuthSplash SVG scenes) load on demand via React Router's route
// `lazy` (the data-router equivalent of React.lazy + Suspense -- the router
// keeps the current page on screen while the chunk loads).
const lazyRoute = (load) => async () => ({ Component: (await load()).default })

const router = createBrowserRouter([
  // Auth pages — standalone, no layout
  { path: '/login',                lazy: lazyRoute(() => import('../features/auth/LoginPage')) },
  { path: '/register',             lazy: lazyRoute(() => import('../features/auth/RegisterPage')) },
  { path: '/oauth/authorize',      lazy: lazyRoute(() => import('../features/auth/OAuthAuthorizePage')) },
  { path: '/oauth/callback',       lazy: lazyRoute(() => import('../features/auth/OAuthCallbackPage')) },
  { path: '/invite/:code',         lazy: lazyRoute(() => import('../features/auth/InviteRedirect')) },
  { path: '/forgot-password',      lazy: lazyRoute(() => import('../features/auth/ForgotPasswordPage')) },
  { path: '/reset-password',       lazy: lazyRoute(() => import('../features/auth/ResetPasswordPage')) },
  { path: '/verify-email',         lazy: lazyRoute(() => import('../features/auth/VerifyEmailPage')) },
  { path: '/resend-verification',  lazy: lazyRoute(() => import('../features/auth/ResendVerificationPage')) },

  // Public routes — visible to all, content varies by auth state
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/posts', element: <PostsPage /> },
      { path: '/posts/:id', element: <PostPage /> },
      { path: '/users', element: <UsersPage /> },
      { path: '/users/:id', element: <UserPage /> },
      { path: '/users/:id/posts', element: <UserPostsPage /> },
      { path: '/users/:id/circles', element: <UserCirclesPage /> },
      { path: '/users/:id/bookmarks', element: <UserBookmarksPage /> },
      { path: '/groups', element: <GroupsPage /> },
      { path: '/groups/:id', element: <GroupPage /> },
      { path: '/groups/:id/posts', element: <GroupPostsPage /> },
      { path: '/circles', element: <CirclesPage /> },
      { path: '/circles/:id', element: <CirclePage /> },
      { path: '/circles/:id/posts', element: <CirclePostsPage /> },
      { path: '/pages', element: <PagesListPage /> },
      { path: '/pages/:id', element: <PageDetailPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/discover', element: <DiscoverPage /> },
      { path: '/servers', element: <ServersPage /> },
      { path: '/server/:domain', element: <ServerPage /> },
    ],
  },

  // Protected routes — Layout redirects to /login if unauthenticated
  {
    element: <Layout />,
    children: [
      { path: '/posts/new', element: <NewPostPage /> },
      { path: '/posts/:id/edit', element: <EditPostPage /> },
      { path: '/groups/new', element: <NewGroupPage /> },
      { path: '/groups/:id/edit', element: <EditGroupPage /> },
      { path: '/groups/:id/pending', element: <GroupPendingPage /> },
      { path: '/circles/new', element: <NewCirclePage /> },
      { path: '/circles/:id/edit', element: <EditCirclePage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },

  // Admin routes — AdminLayout checks auth; each page handles its own 403
  {
    lazy: lazyRoute(() => import('../components/layout/AdminLayout')),
    children: [
      { path: '/admin',            lazy: lazyRoute(() => import('../pages/admin/AdminDashboardPage')) },
      { path: '/admin/users',      lazy: lazyRoute(() => import('../pages/admin/AdminUsersPage')) },
      { path: '/admin/posts',      lazy: lazyRoute(() => import('../pages/admin/AdminPostsPage')) },
      { path: '/admin/groups',     lazy: lazyRoute(() => import('../pages/admin/AdminGroupsPage')) },
      { path: '/admin/circles',    lazy: lazyRoute(() => import('../pages/admin/AdminCirclesPage')) },
      { path: '/admin/invites',    lazy: lazyRoute(() => import('../pages/admin/AdminInvitesPage')) },
      { path: '/admin/moderation', lazy: lazyRoute(() => import('../pages/admin/AdminModerationPage')) },
      { path: '/admin/moderation/:id', lazy: lazyRoute(() => import('../pages/admin/AdminReportPage')) },
      { path: '/admin/themes',     lazy: lazyRoute(() => import('../pages/admin/AdminThemesPage')) },
      { path: '/admin/settings',   lazy: lazyRoute(() => import('../pages/admin/AdminSettingsPage')) },
      { path: '/admin/pages',      lazy: lazyRoute(() => import('../pages/admin/AdminPagesPage')) },
      { path: '/admin/bookmarks',  lazy: lazyRoute(() => import('../pages/admin/AdminBookmarksPage')) },
      { path: '/admin/discovery',  lazy: lazyRoute(() => import('../pages/admin/AdminDiscoveryPage')) },
      { path: '/admin/logs',       lazy: lazyRoute(() => import('../pages/admin/AdminLogsPage')) },
    ],
  },
])

export default router
