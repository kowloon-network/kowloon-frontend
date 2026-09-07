import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getClient, clearClient, resolveServerUrl } from '../../lib/client'

const SERVER_URL_KEY = 'kowloon_server_url'

const getStoredServerUrl = () => {
  if (typeof window === 'undefined') return null
  return (
    localStorage.getItem(SERVER_URL_KEY) ||
    import.meta.env.VITE_SERVER_URL ||
    null
  )
}

// ---------------------------------------------------------------------------
// Async thunks
// ---------------------------------------------------------------------------

export const loginAsync = createAsyncThunk(
  'auth/login',
  async ({ serverUrl, username, password }, { rejectWithValue }) => {
    try {
      const client = getClient(serverUrl)
      const result = await client.auth.login({ username, password })
      localStorage.setItem(SERVER_URL_KEY, serverUrl)
      return { ...result, serverUrl }
    } catch (err) {
      return rejectWithValue(err.message || 'Login failed')
    }
  }
)

export const registerAsync = createAsyncThunk(
  'auth/register',
  async (
    { serverUrl, username, password, email, profile, inviteCode, acknowledgedRules },
    { rejectWithValue }
  ) => {
    try {
      const client = getClient(serverUrl)
      const result = await client.auth.register({
        username,
        password,
        email,
        profile,
        inviteCode,
        acknowledgedRules,
      })
      localStorage.setItem(SERVER_URL_KEY, serverUrl)
      return { ...result, serverUrl }
    } catch (err) {
      return rejectWithValue(err.message || 'Registration failed')
    }
  }
)

// Cross-server OAuth exchange (see /oauth/callback, client.oauth.exchange).
// Unlike loginAsync, serverUrl never changes here — the browser stays on
// this origin the whole time; only the resulting session belongs to a
// foreign identity now recognized by our own backend. Still has to resolve
// AND persist serverUrl itself (matching loginAsync/registerAsync) rather
// than reading it from existing state: on a browser that's never logged
// into this origin before, state.auth.serverUrl starts out null (nothing
// in localStorage yet, no VITE_SERVER_URL baked in), and restoreSessionAsync
// bails out immediately whenever serverUrl is falsy — so without this, the
// visiting session token would be stored fine but silently fail to survive
// a refresh, since restoreSessionAsync would never even attempt to read it.
export const oauthExchangeAsync = createAsyncThunk(
  'auth/oauthExchange',
  async ({ code, homeDomain }, { rejectWithValue }) => {
    try {
      const serverUrl = resolveServerUrl()
      const client = getClient(serverUrl)
      const result = await client.oauth.exchange({ code, homeDomain })
      localStorage.setItem(SERVER_URL_KEY, serverUrl)
      return { ...result, serverUrl }
    } catch (err) {
      return rejectWithValue(err.message || 'OAuth exchange failed')
    }
  }
)

export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    const { serverUrl } = getState().auth
    const client = getClient(serverUrl)
    if (client) await client.auth.logout()
    localStorage.removeItem(SERVER_URL_KEY)
    clearClient()
  }
)

export const restoreSessionAsync = createAsyncThunk(
  'auth/restoreSession',
  async (_, { getState }) => {
    const { serverUrl } = getState().auth
    if (!serverUrl) return null
    try {
      const client = getClient(serverUrl)
      const user = await client.init()
      return user ? { user, serverUrl } : null
    } catch {
      return null
    }
  }
)

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    serverUrl: getStoredServerUrl(),
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    sessionChecked: false,
  },
  reducers: {
    // For future "pick your server" flow
    setServerUrl(state, action) {
      state.serverUrl = action.payload
    },
    clearError(state) {
      state.error = null
    },
    // Merge updated profile/prefs into the auth user without a full re-login
    patchUser(state, action) {
      if (state.user) {
        const patch = action.payload
        state.user = {
          ...state.user,
          ...patch,
          ...(patch.profile ? { profile: { ...state.user.profile, ...patch.profile } } : {}),
          ...(patch.prefs   ? { prefs:   { ...state.user.prefs,   ...patch.prefs   } } : {}),
        }
      }
    },
    // Synchronously drop auth state when the session is already invalid (e.g. an
    // expired token 401'd). Unlike logoutAsync it makes no server call.
    clearAuth(state) {
      state.user = null
      state.token = null
      state.status = 'idle'
      state.error = null
      state.sessionChecked = true
    },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(loginAsync.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.user = action.payload.user
        state.token = action.payload.token
        state.serverUrl = action.payload.serverUrl
        state.sessionChecked = true
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })

      // register
      .addCase(registerAsync.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(registerAsync.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.user = action.payload.user
        state.token = action.payload.token
        state.serverUrl = action.payload.serverUrl
        state.sessionChecked = true
      })
      .addCase(registerAsync.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })

      // oauthExchange
      .addCase(oauthExchangeAsync.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(oauthExchangeAsync.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.user = action.payload.user
        state.token = action.payload.token
        state.serverUrl = action.payload.serverUrl
        state.sessionChecked = true
      })
      .addCase(oauthExchangeAsync.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload
      })

      // logout
      .addCase(logoutAsync.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.status = 'idle'
        state.sessionChecked = true
      })

      // restoreSession
      .addCase(restoreSessionAsync.pending, (state) => {
        state.sessionChecked = false
      })
      .addCase(restoreSessionAsync.fulfilled, (state, action) => {
        state.sessionChecked = true
        if (action.payload) {
          state.user = action.payload.user
          state.serverUrl = action.payload.serverUrl
          state.status = 'succeeded'
        }
      })
      .addCase(restoreSessionAsync.rejected, (state) => {
        state.sessionChecked = true
        state.user = null
      })
  },
})

export const { setServerUrl, clearError, patchUser, clearAuth } = authSlice.actions
export default authSlice.reducer
