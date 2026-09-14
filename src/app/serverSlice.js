import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getClient, resolveServerUrl } from '../lib/client'

export const fetchServerInfoAsync = createAsyncThunk(
  'server/fetchInfo',
  async (_, { rejectWithValue }) => {
    try {
      const serverUrl = resolveServerUrl()
      if (!serverUrl) return rejectWithValue('No server URL configured')
      const client = getClient(serverUrl)
      return await client.feeds.getServerInfo()
    } catch (err) {
      return rejectWithValue(err.message)
    }
  }
)

const serverSlice = createSlice({
  name: 'server',
  initialState: {
    name: null,
    subtitle: null,
    description: null,
    icon: null,
    image: null,
    settings: {},
    status: 'idle',
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchServerInfoAsync.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchServerInfoAsync.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.name            = action.payload.name            ?? null
        state.subtitle        = action.payload.subtitle        ?? null
        state.description     = action.payload.description     ?? null
        state.icon            = action.payload.icon            ?? null
        state.image           = action.payload.image           ?? null
        state.settings        = action.payload.settings        ?? {}
      })
      .addCase(fetchServerInfoAsync.rejected, (state) => {
        state.status = 'failed'
      })
  },
})

export default serverSlice.reducer
