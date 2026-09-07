import { createBrowserRouter } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import PublicLayout from '../components/layout/PublicLayout'
import AdminLayout from '../components/layout/AdminLayout'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import InviteRedirect from '../features/auth/InviteRedirect'
import OAuthAuthorizePage from '../features/auth/OAuthAuthorizePage'
import OAuthCallbackPage from '../features/auth/OAuthCallbackPage'

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

// Admin pages
import AdminDashboardPage  from '../pages/admin/AdminDashboardPage'
import AdminUsersPage      from '../pages/admin/AdminUsersPage'
import AdminPostsPage      from '../pages/admin/AdminPostsPage'
import AdminGroupsPage     from '../pages/admin/AdminGroupsPage'
import AdminCirclesPage    from '../pages/admin/AdminCirclesPage'
import AdminInvitesPage    from '../pages/admin/AdminInvitesPage'
import AdminModerationPage from '../pages/admin/AdminModerationPage'
import AdminSettingsPage        from '../pages/admin/AdminSettingsPage'
import AdminThemesPage          from '../pages/admin/AdminThemesPage'
import AdminPagesPage           from '../pages/admin/AdminPagesPage'
import AdminBookmarksPage       from '../pages/admin/AdminBookmarksPage'
import AdminDiscoveryPage       from '../pages/admin/AdminDiscoveryPage'
import AdminLogsPage            from '../pages/admin/AdminLogsPage'
import ForgotPasswordPage       from '../features/auth/ForgotPasswordPage'
import ResetPasswordPage        from '../features/auth/ResetPasswordPage'
import VerifyEmailPage          from '../features/auth/VerifyEmailPage'
import ResendVerificationPage   from '../features/auth/ResendVerificationPage'

const router = createBrowserRouter([
  // Auth pages — standalone, no layout
  { path: '/login',                element: <LoginPage /> },
  { path: '/register',             element: <RegisterPage /> },
  { path: '/oauth/authorize',      element: <OAuthAuthorizePage /> },
  { path: '/oauth/callback',       element: <OAuthCallbackPage /> },
  { path: '/invite/:code',         element: <InviteRedirect /> },
  { path: '/forgot-password',      element: <ForgotPasswordPage /> },
  { path: '/reset-password',       element: <ResetPasswordPage /> },
  { path: '/verify-email',         element: <VerifyEmailPage /> },
  { path: '/resend-verification',  element: <ResendVerificationPage /> },

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
    element: <AdminLayout />,
    children: [
      { path: '/admin',            element: <AdminDashboardPage /> },
      { path: '/admin/users',      element: <AdminUsersPage /> },
      { path: '/admin/posts',      element: <AdminPostsPage /> },
      { path: '/admin/groups',     element: <AdminGroupsPage /> },
      { path: '/admin/circles',    element: <AdminCirclesPage /> },
      { path: '/admin/invites',    element: <AdminInvitesPage /> },
      { path: '/admin/moderation', element: <AdminModerationPage /> },
      { path: '/admin/themes',     element: <AdminThemesPage /> },
      { path: '/admin/settings',   element: <AdminSettingsPage /> },
      { path: '/admin/pages',      element: <AdminPagesPage /> },
      { path: '/admin/bookmarks',  element: <AdminBookmarksPage /> },
      { path: '/admin/discovery',  element: <AdminDiscoveryPage /> },
      { path: '/admin/logs',       element: <AdminLogsPage /> },
    ],
  },
])

export default router
