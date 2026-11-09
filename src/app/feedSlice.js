// feedSlice — manages feed/timeline state.
// Tracks current circle, active post type filters, pinned circle IDs, and default type prefs.
//
// Preferences (defaultTypes, pinnedCircleIds) are loaded automatically from the user object
// on login/session restore by listening to auth thunks via extraReducers.
// They are saved back to the server via saveDefaultTypesAsync / savePinnedCirclesAsync.
//
// Expected user profile shape (from server):
//   user.prefs.defaultPostView   — string[]  e.g. ['Note', 'Article']
//   user.prefs.pinnedCircleIds   — string[]  e.g. ['circle:abc@domain']

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getClient } from '../lib/client'
import { loginAsync, registerAsync, logoutAsync, restoreSessionAsync, clearAuth } from '../features/auth/authSlice'

// ── Async thunks ────────────────────────────────────────────────────────────

export const saveDefaultTypesAsync = createAsyncThunk(
  'feed/saveDefaultTypes',
  async (types, { getState, rejectWithValue }) => {
    const { serverUrl } = getState().auth
    try {
      const client = getClient(serverUrl)
      await client.activities.updateProfile({ prefs: { defaultPostView: types } })
      return types
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to save default types')
    }
  }
)

export const savePinnedCirclesAsync = createAsyncThunk(
  'feed/savePinnedCircles',
  async (pinnedCircleIds, { getState, rejectWithValue }) => {
    const { serverUrl } = getState().auth
    try {
      const client = getClient(serverUrl)
      await client.activities.updateProfile({ prefs: { pinnedCircleIds } })
      return pinnedCircleIds
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to save pinned circles')
    }
  }
)

// ── Helpers ─────────────────────────────────────────────────────────────────

const STORAGE_KEY_CIRCLE = 'kowloon:feed:lastCircleId'
const STORAGE_KEY_VIEW    = 'kowloon:feed:view'
const STORAGE_KEY_TYPES  = 'kowloon:feed:activeTypes'

function readPersistedCircleId() {
  if (typeof localStorage === 'undefined') return null
  try { return localStorage.getItem(STORAGE_KEY_CIRCLE) || null } catch { return null }
}

function writePersistedCircleId(id) {
  if (typeof localStorage === 'undefined') return
  try {
    if (id) localStorage.setItem(STORAGE_KEY_CIRCLE, id)
    else    localStorage.removeItem(STORAGE_KEY_CIRCLE)
  } catch { /* quota or private mode — fall through silently */ }
}

// The home feed "view" — matches the mobile app's viewKey:
//   'all'          — merged public + server (getServerPosts)
//   'mine'         — everything you've posted (getUserPosts, self)
//   'circle:<id>…' — a circle feed (getCirclePosts)
//   'group:<id>…'  — a joined group feed (getGroupPosts)
function readPersistedView() {
  if (typeof localStorage === 'undefined') return null
  try { return localStorage.getItem(STORAGE_KEY_VIEW) || null } catch { return null }
}

function writePersistedView(v) {
  if (typeof localStorage === 'undefined') return
  try {
    if (v) localStorage.setItem(STORAGE_KEY_VIEW, v)
    else   localStorage.removeItem(STORAGE_KEY_VIEW)
  } catch { /* quota or private mode — fall through silently */ }
}

function readPersistedTypes() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TYPES)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

function writePersistedTypes(types) {
  if (typeof localStorage === 'undefined') return
  try {
    if (Array.isArray(types)) localStorage.setItem(STORAGE_KEY_TYPES, JSON.stringify(types))
    else                      localStorage.removeItem(STORAGE_KEY_TYPES)
  } catch { /* quota or private mode — fall through silently */ }
}

function loadPrefsFromUser(state, user, { preserveActiveTypes = false } = {}) {
  const prefs = user?.prefs ?? {}
  state.defaultTypes    = prefs.defaultPostView  ?? []
  state.defaultView     = prefs.defaultFeedView  ?? 'all'
  state.pinnedCircleIds = prefs.pinnedCircleIds  ?? []
  // On session restore, keep whatever filter/view the user had last applied.
  // On fresh login, fall through to their saved defaults.
  if (!preserveActiveTypes) {
    state.activeTypes = prefs.defaultPostView ?? []
    writePersistedTypes(state.activeTypes.length ? state.activeTypes : null)
    state.view = prefs.defaultFeedView ?? 'all'
    writePersistedView(state.view === 'all' ? null : state.view)
  } else if (!readPersistedView()) {
    // Fresh device (nothing persisted yet): seed the view from the saved
    // default even on a session restore, matching mobile's fallbackDefaults.
    state.view = prefs.defaultFeedView ?? 'all'
    writePersistedView(state.view === 'all' ? null : state.view)
  }
}

function resetFeedState(state) {
  state.circleId        = null
  state.view            = 'all'
  state.activeTypes     = []
  state.defaultTypes    = []
  state.defaultView     = 'all'
  state.pinnedCircleIds = []
  writePersistedCircleId(null)
  writePersistedView(null)
  writePersistedTypes(null)
}

// ── Slice ───────────────────────────────────────────────────────────────────

const feedSlice = createSlice({
  name: 'feed',
  initialState: {
    // Hydrated from localStorage so the user's last-viewed circle and active
    // type filter survive a page reload. HomePage validates the saved circle
    // against the loaded list and falls back to Following if it's gone.
    circleId: readPersistedCircleId(),
    view: readPersistedView() ?? 'all',
    activeTypes: readPersistedTypes() ?? [],
    defaultTypes: [],     // user's saved default type filter  (prefs.defaultPostView)
    defaultView: 'all',   // user's saved default feed view     (prefs.defaultFeedView)
    pinnedCircleIds: [],  // user-pinned circle IDs (from profile)
  },
  reducers: {
    setCircle(state, action) {
      state.circleId = action.payload
      writePersistedCircleId(action.payload)
    },

    // Set the home feed view ('all' | 'mine' | circleId | groupId).
    setView(state, action) {
      state.view = action.payload || 'all'
      writePersistedView(state.view === 'all' ? null : state.view)
    },

    toggleType(state, action) {
      const type = action.payload
      if (state.activeTypes.includes(type)) {
        state.activeTypes = state.activeTypes.filter((t) => t !== type)
      } else {
        state.activeTypes.push(type)
      }
      writePersistedTypes(state.activeTypes.length ? state.activeTypes : null)
    },

    // Replace the active-types selection wholesale ([] === all). The shared
    // TypeFilter owns the solo-on-first-tap logic and dispatches the result.
    setTypes(state, action) {
      const next = Array.isArray(action.payload) ? action.payload : []
      state.activeTypes = next
      writePersistedTypes(next.length ? next : null)
    },

    clearTypes(state) {
      state.activeTypes = []
      writePersistedTypes(null)
    },

    // Mark the current view / type-filter as the account default. The server
    // write (client.activities.updateProfile) is fired by the caller; these
    // just update the local "is default" markers so the ⋮ menu reflects it.
    setDefaultView(state, action) {
      state.defaultView = action.payload || 'all'
    },

    setDefaultTypes(state, action) {
      state.defaultTypes = Array.isArray(action.payload) ? action.payload : []
    },

    // Restore active types back to the saved defaults
    resetToDefaults(state) {
      state.activeTypes = [...state.defaultTypes]
      writePersistedTypes(state.activeTypes.length ? state.activeTypes : null)
    },

    pinCircle(state, action) {
      if (!state.pinnedCircleIds.includes(action.payload)) {
        state.pinnedCircleIds.push(action.payload)
      }
    },

    unpinCircle(state, action) {
      state.pinnedCircleIds = state.pinnedCircleIds.filter((id) => id !== action.payload)
    },
  },

  extraReducers: (builder) => {
    builder
      // Load prefs when user logs in. Reset activeTypes to the user's saved
      // default — we don't want one user's session filter leaking into the
      // next user's session.
      .addCase(loginAsync.fulfilled, (state, action) => {
        loadPrefsFromUser(state, action.payload.user)
      })
      // Load prefs when session is restored. Keep activeTypes as-is so the
      // filter survives a page reload.
      .addCase(restoreSessionAsync.fulfilled, (state, action) => {
        if (action.payload?.user) loadPrefsFromUser(state, action.payload.user, { preserveActiveTypes: true })
      })
      // New users get blank prefs
      .addCase(registerAsync.fulfilled, (state) => {
        resetFeedState(state)
      })
      // Clear everything on logout
      .addCase(logoutAsync.fulfilled, (state) => {
        resetFeedState(state)
      })
      .addCase(logoutAsync.rejected, (state) => {
        resetFeedState(state)
      })
      // Session expired (lib/client.js handleSessionExpired) -- same as logout
      .addCase(clearAuth, (state) => {
        resetFeedState(state)
      })
      // On successful save, update defaultTypes to match what was saved
      .addCase(saveDefaultTypesAsync.fulfilled, (state, action) => {
        state.defaultTypes = action.payload
      })
      .addCase(savePinnedCirclesAsync.fulfilled, (state, action) => {
        state.pinnedCircleIds = action.payload
      })
  },
})

export const {
  setCircle,
  setView,
  toggleType,
  setTypes,
  clearTypes,
  resetToDefaults,
  setDefaultView,
  setDefaultTypes,
  pinCircle,
  unpinCircle,
} = feedSlice.actions

export default feedSlice.reducer
