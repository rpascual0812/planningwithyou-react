export type SettingsSection =
  | 'account'
  | 'companies'
  | 'user-settings'
  | 'suppliers'
  | 'calendar'
  | 'email-settings'
  | 'quotations'
  | 'permissions'
  | 'connection'

export type SettingsNavItem = {
  id: SettingsSection
  label: string
  icon: string,
  description: string
}

export type AdminSection =
  | 'accounts'
  | 'kyb'
  | 'emails'
  | 'payouts'
  | 'notifications'
  | 'support'
  | 'error-logs'
  | 'subscriptions'

export type AdminNavItem = {
  id: AdminSection
  label: string
  icon: string
}
