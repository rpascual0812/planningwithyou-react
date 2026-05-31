export type IntegrationId =
  | 'gmail'
  | 'google-calendar'
  | 'microsoft-outlook'
  | 'microsoft-calendar'
  | 'apple-email'
  | 'apple-calendar'
  | 'yahoo-email'
  | 'yahoo-calendar'
  | 'facebook-messenger'

export type IntegrationPurpose = 'email' | 'calendar' | 'messaging'

export type Integration = {
  id: IntegrationId
  name: string
  description: string
  iconClass: string
  color: string
  purpose: IntegrationPurpose
  permissions: string
  /** When false, shown but not connectable (coming soon). */
  available?: boolean
}

export function isIntegrationAvailable(integration: Integration): boolean {
  return integration.available !== false
}

export type IntegrationGroupMeta = {
  id: IntegrationPurpose
  title: string
  description: string
  iconClass: string
  permissions: string
}

export const INTEGRATION_GROUP_META: IntegrationGroupMeta[] = [
  {
    id: 'email',
    title: 'Email Integration',
    description: 'Connect inboxes to send and receive messages from your account.',
    iconClass: 'bi-envelope',
    permissions: 'Email, and messaging access',
  },
  {
    id: 'calendar',
    title: 'Calendar Integrations',
    description: 'Sync events, availability, and reminders with your calendars.',
    iconClass: 'bi-calendar3',
    permissions: 'Email, calendar, and messaging access',
  },
  {
    id: 'messaging',
    title: 'Messaging',
    description: 'Receive and reply to conversations from messaging apps.',
    iconClass: 'bi-chat-dots',
    permissions: 'Messaging access',
  },
]

export const INTEGRATIONS: Integration[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Connect Gmail to send emails from the app using your Google account.',
    iconClass: 'bi-envelope-fill',
    color: '#ea4335',
    purpose: 'email',
    permissions: 'Email access',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync events and availability with Google Calendar.',
    iconClass: 'bi-calendar-event-fill',
    color: '#4285f4',
    purpose: 'calendar',
    permissions: 'Calendar access',
  },
  {
    id: 'microsoft-outlook',
    name: 'Microsoft Outlook',
    description: 'Connect Outlook to manage email in one place.',
    iconClass: 'bi-microsoft',
    color: '#0078d4',
    purpose: 'email',
    permissions: 'Email access',
    available: false,
  },
  {
    id: 'microsoft-calendar',
    name: 'Microsoft Calendar',
    description: 'Sync schedules and meetings with Microsoft Calendar.',
    iconClass: 'bi-calendar3-fill',
    color: '#0078d4',
    purpose: 'calendar',
    permissions: 'Calendar access',
    available: false,
  },
  {
    id: 'apple-email',
    name: 'Apple Email',
    description: 'Connect Apple Mail to manage messages from your account.',
    iconClass: 'bi-apple',
    color: '#555555',
    purpose: 'email',
    permissions: 'Email access',
    available: false,
  },
  {
    id: 'apple-calendar',
    name: 'Apple Calendar',
    description: 'Sync events and reminders with Apple Calendar.',
    iconClass: 'bi-calendar2-week-fill',
    color: '#555555',
    purpose: 'calendar',
    permissions: 'Calendar access',
    available: false,
  },
  {
    id: 'yahoo-email',
    name: 'Yahoo Email',
    description: 'Connect Yahoo Mail to send and receive messages.',
    iconClass: 'bi-envelope-at-fill',
    color: '#6001d2',
    purpose: 'email',
    permissions: 'Email access',
    available: false,
  },
  {
    id: 'yahoo-calendar',
    name: 'Yahoo Calendar',
    description: 'Sync events and availability with Yahoo Calendar.',
    iconClass: 'bi-calendar-check-fill',
    color: '#6001d2',
    purpose: 'calendar',
    permissions: 'Calendar access',
    available: false,
  },
  {
    id: 'facebook-messenger',
    name: 'Facebook Messenger',
    description: 'Connect Messenger to receive and reply to conversations.',
    iconClass: 'bi-messenger',
    color: '#0084ff',
    purpose: 'messaging',
    permissions: 'Messaging access',
  },
]

export function groupMetaFor(purpose: IntegrationPurpose): IntegrationGroupMeta {
  const meta = INTEGRATION_GROUP_META.find((g) => g.id === purpose)
  if (!meta) throw new Error(`Unknown integration group: ${purpose}`)
  return meta
}

export function integrationsForPurpose(purpose: IntegrationPurpose): Integration[] {
  return INTEGRATIONS.filter((i) => i.purpose === purpose)
}

export function initialIntegrationEnabledState(): Record<IntegrationId, boolean> {
  return INTEGRATIONS.reduce<Record<IntegrationId, boolean>>(
    (acc, integration) => {
      if (integration.id === 'google-calendar' || integration.id === 'gmail') {
        acc[integration.id] = false
      } else {
        acc[integration.id] = isIntegrationAvailable(integration)
      }
      return acc
    },
    {} as Record<IntegrationId, boolean>,
  )
}
