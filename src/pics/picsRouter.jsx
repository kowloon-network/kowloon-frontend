import { createBrowserRouter } from 'react-router-dom'
import PicsLayout from './PicsLayout'
import PicsGridPage from './PicsGridPage'
import ExternalRedirect from './ExternalRedirect'

const picsRouter = createBrowserRouter([
  // Lazy, like the main router: LoginPage carries the heavy AuthSplash SVGs.
  { path: '/login', lazy: async () => ({ Component: (await import('../features/auth/LoginPage')).default }) },
  {
    element: <PicsLayout />,
    children: [{ path: '/', element: <PicsGridPage /> }],
  },
  // Any other path (reused components' <Link>s to /circles, /users/:id,
  // /notifications, /posts/:id/edit, ...) bounces to the main domain.
  { path: '*', element: <ExternalRedirect /> },
])

export default picsRouter
