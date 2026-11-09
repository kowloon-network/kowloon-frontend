// PicsApp — root component for pics.<domain>, mounted by main.jsx when
// window.location.hostname starts with "pics.". Wraps the exact same way
// App.jsx does (Provider/AuthSync/ToastStack/TypographyProvider) — every
// reused component (Header, PostComposer, PostToolbar, ReactButton,
// useClient) calls useSelector/useDispatch and throws without this.
//
// `store` is the same `app/store.js` singleton App.jsx uses, but this is a
// separate page load on a separate origin (pics.<domain> vs <domain>), so
// it's a fresh store instance for this tab, not shared/cross-contaminated
// with the main site's — same for localStorage (auth token, saved theme,
// feed view, etc.), which is strictly per-origin.

import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { store } from '../app/store'
import { setActiveTheme } from '../features/theme/themeSlice'
import picsRouter from './picsRouter'
import AuthSync from '../app/AuthSync'
import DocumentTitle from '../app/DocumentTitle'
import ToastStack from '../components/ui/ToastStack'
import { TypographyProvider } from '../lib/TypographyProvider'

// Force the built-in dark theme, no toggle — dispatched once at module
// evaluation (before first render) so there's no flash of the light theme
// while fetchThemesAsync/restoreSessionAsync are still in flight. `available`
// is seeded with the built-in fallback themes (including 'kowloon-dark')
// before any server fetch resolves, so this resolves synchronously.
// Persisting the choice to (pics' own) localStorage also makes
// fetchThemesAsync.fulfilled's own "saved theme wins" logic keep it dark
// once the server's real theme list arrives. See app/store.js for the one
// remaining override this doesn't cover (a logged-in user's own saved theme
// preference, applied after session restore) — guarded there directly.
//
// GUARDED on hostname (2026-09-03 fix): this file used to be statically
// imported by main.jsx unconditionally (it's lazy-loaded on pics.* only
// since 2026-11, but keep the guard) — module-level code here ran
// on EVERY page load, main site included, not just pics.<domain>. Without
// this check, every visit to the main site force-set + persisted dark theme
// to localStorage, silently overriding the server's/admin's default theme
// resolution in fetchThemesAsync.fulfilled moments later. Found while
// verifying the admin site-theme feature actually reaches real visitors.
if (window.location.hostname.startsWith('pics.')) {
  store.dispatch(setActiveTheme('kowloon-dark'))
}

export default function PicsApp() {
  return (
    <Provider store={store}>
      <AuthSync />
      <DocumentTitle />
      <TypographyProvider>
        <RouterProvider router={picsRouter} />
      </TypographyProvider>
      <ToastStack />
    </Provider>
  )
}
