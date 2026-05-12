export type SettingsSection =
  | 'account'
  | 'companies'
  | 'form-designs'
  | 'calendar'
  | 'bookings'
  | 'permissions'
  | 'connection'
  | 'subscription'

export type SettingsNavItem = {
  id: SettingsSection
  label: string
  icon: string
}
