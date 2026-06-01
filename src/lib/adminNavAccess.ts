import type { UserRecord } from '../services/users'
import type { AdminSection } from '../pages/settings/types'
import { canRead } from './featureAccess'

const ADMIN_TAB_ORDER: AdminSection[] = [
  'accounts',
  'kyb',
  'emails',
  'payouts',
  'notifications',
  'support',
]

/** Feature key for each Admin sidebar tab. */
const TAB_READ_FEATURES: Record<AdminSection, string> = {
  accounts: 'admin_accounts',
  kyb: 'admin_company_verification',
  emails: 'admin_emails',
  payouts: 'admin_payouts',
  notifications: 'admin_system_notifications',
  support: 'admin_support',
}

/** Can open the Admin area (sidebar / route shell). */
export function canAccessAdmin(user: UserRecord | null): boolean {
  return canRead(user, 'platform_admin')
}

export function canAccessAdminTab(
  user: UserRecord | null,
  tab: AdminSection,
): boolean {
  if (!user || !canAccessAdmin(user)) return false
  return canRead(user, TAB_READ_FEATURES[tab])
}

export function canAccessAnyAdminTab(user: UserRecord | null): boolean {
  if (!user) return false
  return ADMIN_TAB_ORDER.some((tab) => canAccessAdminTab(user, tab))
}

export function firstAccessibleAdminTab(user: UserRecord | null): AdminSection {
  for (const tab of ADMIN_TAB_ORDER) {
    if (canAccessAdminTab(user, tab)) return tab
  }
  return ADMIN_TAB_ORDER[0]
}

export function adminFeatureKeyForTab(tab: AdminSection): string {
  return TAB_READ_FEATURES[tab]
}
