export type SettingsSection =
  | 'account'
  | 'companies'
  | 'suppliers'
  | 'email-templates'
  | 'calendar'
  | 'email-settings'
  | 'bookings'
  | 'permissions'
  | 'connection'

export type SettingsNavItem = {
  id: SettingsSection
  label: string
  icon: string,
  description: string
}

export type AdminSection =
  | 'kyb'
  | 'emails'
  | 'payouts'
  | 'notifications'
  | 'support'

export type AdminNavItem = {
  id: AdminSection
  label: string
  icon: string
}
