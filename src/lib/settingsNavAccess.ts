import type { UserRecord } from '../services/users'
import type { SettingsSection } from '../pages/settings/types'
import { canRead } from './featureAccess'

const SETTINGS_TAB_ORDER: SettingsSection[] = [
  'account',
  'companies',
  'suppliers',
  'calendar',
  'email-settings',
  'bookings',
  'email-templates',
  'permissions',
  'connection',
]

/** Minimum read permission required for each settings sidebar tab. */
const TAB_READ_FEATURES: Record<SettingsSection, string | string[]> = {
  account: 'account_settings',
  companies: 'companies_settings',
  suppliers: 'supplier_settings',
  calendar: 'calendar_settings',
  'email-settings': 'settings',
  bookings: 'booking_settings_statuses',
  'email-templates': 'email_templates',
  permissions: 'roles_permissions',
  connection: 'settings',
}

export function canAccessSettingsTab(
  user: UserRecord | null,
  tab: SettingsSection,
): boolean {
  if (!user) return false
  const required = TAB_READ_FEATURES[tab]
  if (Array.isArray(required)) {
    return required.some((key) => canRead(user, key))
  }
  return canRead(user, required)
}

export function canAccessAnySettings(user: UserRecord | null): boolean {
  if (!user) return false
  return SETTINGS_TAB_ORDER.some((tab) => canAccessSettingsTab(user, tab))
}

export function firstAccessibleSettingsTab(
  user: UserRecord | null,
): SettingsSection {
  for (const tab of SETTINGS_TAB_ORDER) {
    if (canAccessSettingsTab(user, tab)) return tab
  }
  return 'account'
}
