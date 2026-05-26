import type { UserRecord } from '../services/users'
import { canRead } from './featureAccess'

/** Sidebar order: first readable route wins for access-denied redirects. */
const NAV_ROUTES: { feature: string; path: string }[] = [
  { feature: 'dashboard', path: '/' },
  { feature: 'calendar', path: '/calendar' },
  { feature: 'bookings', path: '/bookings' },
  { feature: 'contacts', path: '/contacts' },
  { feature: 'users', path: '/users' },
  { feature: 'emails', path: '/emails' },
  { feature: 'file_manager', path: '/file-manager' },
  { feature: 'reports', path: '/reports' },
  { feature: 'settings', path: '/settings' },
]

/** Where to send a user who cannot open the requested feature. */
export function firstAccessiblePath(user: UserRecord | null): string {
  if (!user) return '/login'
  for (const { feature, path } of NAV_ROUTES) {
    if (canRead(user, feature)) return path
  }
  return '/profile'
}
