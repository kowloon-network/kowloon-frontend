import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getClient } from '../../lib/client'
import { logoutAsync, clearAuth } from '../auth/authSlice'

const initialState = {
  items: [],
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
}

export const fetchMyCircles = createAsyncThunk(
  'myCircles/fetch',
  async (_, { getState }) => {
    const { user, serverUrl } = getState().auth
    if (!user?.id) return []
    const client = getClient(serverUrl)
    const res = await client.feeds.getUserCircles({ userId: user.id })
    return res?.orderedItems ?? res?.items ?? []
  }
)

const myCirclesSlice = createSlice({
  name: 'myCircles',
  initialState,
  reducers: {
    invalidateMyCircles(state) {
      state.status = 'idle'
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyCircles.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchMyCircles.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchMyCircles.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message ?? 'Failed to load circles'
      })
      // Circles belong to the signed-in user: drop them on logout/expiry.
      .addCase(logoutAsync.fulfilled, () => initialState)
      .addCase(logoutAsync.rejected, () => initialState)
      .addCase(clearAuth, () => initialState)
  },
})

export const { invalidateMyCircles } = myCirclesSlice.actions
export default myCirclesSlice.reducer
