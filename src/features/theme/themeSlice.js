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
import palette from '@kowloon/design/tokens/palette.json'

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
// Exactly the three the app offers (System/Light/Dark). Colors are built from
// @kowloon/design/tokens/palette.json -- the single source of truth shared with
// the mobile app and the generated theme CSS -- so they can't drift.
// `post-*` keys become postColors; header tokens aren't themeable and are
// left to the generated CSS.

function themeFromPalette(map) {
  const colors = {}
  const postColors = {}
  for (const [key, value] of Object.entries(map)) {
    if (key.startsWith('post-')) postColors[key.slice(5)] = value
    else if (!key.startsWith('header')) colors[key] = value
  }
  return { colors, postColors }
}

const FALLBACK_THEMES = [
  { id: 'system', name: 'System', colorScheme: 'system', isBuiltIn: true, colors: null, postColors: null },
  { id: 'kowloon-light', name: 'Kowloon Light', colorScheme: 'light', isBuiltIn: true, ...themeFromPalette(palette.light) },
  { id: 'kowloon-dark', name: 'Kowloon Dark', colorScheme: 'dark', isBuiltIn: true, ...themeFromPalette(palette.dark) },
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
