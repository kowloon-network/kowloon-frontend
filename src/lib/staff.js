// The signed-in user's place on the server's staff: 'admin', 'mod' or null.
// What moderators may do is decided on the server
// (server/methods/auth/staffPolicy.js); the UI only hides what they can't
// use. isServerAdmin / isServerMod come from login and /auth/me.

import { useSelector } from 'react-redux'

export function staffRole(user) {
  if (user?.isServerAdmin) return 'admin'
  if (user?.isServerMod) return 'mod'
  return null
}

export function useStaffRole() {
  const user = useSelector((state) => state.auth.user)
  return staffRole(user)
}

// Admin-panel sections a moderator can open.
export const MOD_SECTIONS = new Set([
  '/admin',
  '/admin/moderation',
  '/admin/users',
  '/admin/circles',
  '/admin/discovery',
  '/admin/pages',
  '/admin/bookmarks',
])
