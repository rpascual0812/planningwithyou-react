import type { UserRecord } from '../services/users'
import { canRead } from './featureAccess'
import { canAccessAdmin } from './adminNavAccess'
import { canAccessAnySettings } from './settingsNavAccess'

/** Sidebar order: first readable route wins for access-denied redirects. */
const NAV_ROUTES: { feature: string; path: string }[] = [
  { feature: 'dashboard', path: '/' },
  { feature: 'calendar', path: '/calendar' },
  { feature: 'bookings', path: '/quotations' },
  { feature: 'contacts', path: '/contacts' },
  { feature: 'users', path: '/users' },
  { feature: 'emails', path: '/emails' },
  { feature: 'file_manager', path: '/file-manager' },
  { feature: 'template_studio', path: '/invitations' },
  { feature: 'reports', path: '/reports' },
  { feature: 'settings', path: '/settings' },
  { feature: 'platform_admin', path: '/admin' },
]

/** Where to send a user who cannot open the requested feature. */
export function firstAccessiblePath(user: UserRecord | null): string {
  if (!user) return '/login'
  for (const { feature, path } of NAV_ROUTES) {
    if (path === '/settings') {
      if (canAccessAnySettings(user)) return path
      continue
    }
    if (path === '/admin') {
      if (canAccessAdmin(user)) return path
      continue
    }
    if (canRead(user, feature)) return path
  }
  return '/profile'
}
