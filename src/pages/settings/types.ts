export type SettingsSection =
  | 'account'
  | 'companies'
  | 'suppliers'
  | 'email-templates'
  | 'calendar'
  | 'bookings'
  | 'permissions'
  | 'connection'

export type SettingsNavItem = {
  id: SettingsSection
  label: string
  icon: string
}

export type AdminSection =
  | 'kyb'
  | 'emails'
  | 'payouts'
  | 'support'

export type AdminNavItem = {
  id: AdminSection
  label: string
  icon: string
}
