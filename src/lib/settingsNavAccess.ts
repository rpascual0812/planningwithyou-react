import type { UserRecord } from '../services/users'
import type { SettingsSection } from '../pages/settings/types'
import { canRead } from './featureAccess'

/** Minimum read permission required for each settings sidebar tab. */
const TAB_READ_FEATURES: Record<SettingsSection, string | string[]> = {
  account: 'account_settings',
  companies: 'companies_settings',
  suppliers: 'supplier_settings',
  calendar: 'calendar',
  bookings: ['booking_settings_statuses', 'booking_settings_form_templates'],
  'email-templates': 'email_templates',
  permissions: 'settings',
  connection: 'settings',
}

export function canAccessSettingsTab(
  user: UserRecord | null,
  tab: SettingsSection,
): boolean {
  if (!user) return false
  if (!canRead(user, 'settings')) return false
  const required = TAB_READ_FEATURES[tab]
  if (Array.isArray(required)) {
    return required.some((key) => canRead(user, key))
  }
  return canRead(user, required)
}

export function firstAccessibleSettingsTab(
  user: UserRecord | null,
): SettingsSection {
  const order: SettingsSection[] = [
    'account',
    'companies',
    'suppliers',
    'calendar',
    'bookings',
    'email-templates',
    'permissions',
    'connection',
  ]
  for (const tab of order) {
    if (canAccessSettingsTab(user, tab)) return tab
  }
  return 'account'
}
