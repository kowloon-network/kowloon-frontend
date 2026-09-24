// themeSlice — manages available themes, active theme, and CSS injection.
//
// Theme application works by inserting/updating a <style id="kowloon-active-theme">
// element in <head>. This overrides the base [data-theme="kowloon"] variables in
// index.css because the injected <style> comes later in the document.
//
// The "system" theme (colorScheme: "system") clears the injected style, letting
// index.css's @media (prefers-color-scheme: dark) override handle dark mode.

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getClient, resolveServerUrl } from '../../lib/client'

const STORAGE_KEY = 'kowloon_theme'

// ── CSS injection ─────────────────────────────────────────────────────────────

export function injectTheme(theme) {
  if (typeof document === 'undefined') return

  let el = document.getElementById('kowloon-active-theme')
  if (!el) {
    el = document.createElement('style')
    el.id = 'kowloon-active-theme'
    document.head.appendChild(el)
  }

  if (!theme || theme.colorScheme === 'system') {
    // Clear override — index.css @media (prefers-color-scheme: dark) takes over
    el.textContent = ''
    return
  }

  const colorVars = Object.entries(theme.colors || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `  --color-${k}: ${v};`)
    .join('\n')

  const postColorVars = Object.entries(theme.postColors || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `  --post-color-${k}: ${v};`)
    .join('\n')

  const body = [colorVars, postColorVars].filter(Boolean).join('\n')

  // Targeting [data-theme="kowloon"] which is on <html>, so this rule has
  // the same specificity as index.css but comes later — it wins.
  el.textContent = `[data-theme="kowloon"] {\n  color-scheme: ${theme.colorScheme};\n${body}\n}`
}

// ── Async thunk ───────────────────────────────────────────────────────────────

export const fetchThemesAsync = createAsyncThunk(
  'theme/fetchThemes',
  async (_, { rejectWithValue }) => {
    try {
      // Same resolution as every other API call in the app (explicit config,
      // env, localStorage, then same-origin) — this slice previously had its
      // own narrower copy that stopped short of the same-origin fallback, so
      // a true first-time anonymous visitor (no prior login on that browser,
      // no VITE_SERVER_URL baked into a same-origin production build) never
      // got a server URL at all and the fetch silently never fired. That
      // meant an admin's site-wide theme never actually reached the logged-
      // out visitors it's mainly for.
      const serverUrl = resolveServerUrl()
      if (!serverUrl) return rejectWithValue('No server URL')
      const client = getClient(serverUrl)
      return await client.themes.list()
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

// ── Fallback themes (shown before server responds or if fetch fails) ──────────
// Exactly the three the app offers (System/Light/Dark). Colors are a literal
// copy of @kowloon/design/tokens/palette.json's light/dark maps, the single
// source of truth shared with the mobile app. Keep in sync by hand if
// palette.json changes; mirrors the same copy in server/routes/themes/index.js
// (a separate repo — not touched by this pass, worth checking next time
// palette.json changes).

const FALLBACK_THEMES = [
  { id: 'system', name: 'System', colorScheme: 'system', isBuiltIn: true, colors: null, postColors: null },
  {
    id: 'kowloon-light', name: 'Kowloon Light', colorScheme: 'light', isBuiltIn: true,
    colors: {
      'base-100': '#ffffff', 'base-200': '#f4f4f4',
      'base-300': '#e7e7e7', 'base-content': '#1a1a20',
      'primary': '#5588b1', 'primary-content': '#f4f5f7',
      'secondary': '#393b7a', 'secondary-content': '#faf4e8',
      'accent': '#e75423', 'accent-content': '#1a1a20',
      'neutral': '#1a1a20', 'neutral-content': '#f4f4f4',
      'info': '#3c8db8', 'info-content': '#f0f6fa',
      'success': '#2f9956', 'success-content': '#f0f8f2',
      'warning': '#d9b038', 'warning-content': '#1a1a20',
      'error': '#c0394a', 'error-content': '#f7e8e8',
    },
    postColors: { note: '#b76c00', article: '#006893', media: '#009084', link: '#417843', event: '#cc272e' },
  },
  {
    id: 'kowloon-dark', name: 'Kowloon Dark', colorScheme: 'dark', isBuiltIn: true,
    colors: {
      'base-100': '#16171d', 'base-200': '#1f2129',
      'base-300': '#2c2f3a', 'base-content': '#f4f4f4',
      'primary': '#5588b1', 'primary-content': '#0e1116',
      'secondary': '#393b7a', 'secondary-content': '#faf4e8',
      'accent': '#e8987d', 'accent-content': '#1a1a20',
      'neutral': '#1f2129', 'neutral-content': '#f4f4f4',
      'info': '#3c8db8', 'info-content': '#f0f6fa',
      'success': '#2f9956', 'success-content': '#f0f8f2',
      'warning': '#d9b038', 'warning-content': '#1a1a20',
      'error': '#c0394a', 'error-content': '#f7e8e8',
    },
    postColors: { note: '#e8920a', article: '#2ab4e8', media: '#00c4ae', link: '#62c278', event: '#ee5566' },
  },
]

// ── Slice ─────────────────────────────────────────────────────────────────────

const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    available: FALLBACK_THEMES,
    activeId: localStorage.getItem(STORAGE_KEY) || 'system',
    serverDefault: 'system',
    loading: false,
  },
  reducers: {
    // Set active theme by ID, persist to localStorage, inject CSS immediately.
    setActiveTheme(state, action) {
      const id = action.payload
      state.activeId = id
      localStorage.setItem(STORAGE_KEY, id)
      const theme = state.available.find((t) => t.id === id) ?? null
      injectTheme(theme)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchThemesAsync.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchThemesAsync.fulfilled, (state, action) => {
        state.loading = false
        const { themes = [], defaultThemeId = 'system' } = action.payload ?? {}
        state.available = themes
        state.serverDefault = defaultThemeId

        // Determine which theme to apply:
        // 1. User's explicit localStorage choice
        // 2. Server default
        const saved = localStorage.getItem(STORAGE_KEY)
        const resolvedId = saved || defaultThemeId
        state.activeId = resolvedId

        const theme = themes.find((t) => t.id === resolvedId) ?? null
        injectTheme(theme)
      })
      .addCase(fetchThemesAsync.rejected, (state) => {
        state.loading = false
      })
  },
})

export const { setActiveTheme } = themeSlice.actions
export default themeSlice.reducer
