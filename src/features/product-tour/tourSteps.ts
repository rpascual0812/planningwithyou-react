import type { UserRecord } from '../../services/users'
import { canRead } from '../../lib/featureAccess'
import { canAccessAdminTab, canAccessAnyAdminTab } from '../../lib/adminNavAccess'
import {
  canAccessAnySettings,
  canAccessSettingsTab,
} from '../../lib/settingsNavAccess'
import type { AdminSection, SettingsSection } from '../../pages/settings/types'

export type TourStepMeta = {
  element: string
  title: string
  description: string
  /** Navigate before highlighting (pathname + search). */
  path?: string
  popoverSide?: 'top' | 'right' | 'bottom' | 'left'
  popoverAlign?: 'start' | 'center' | 'end'
}

const SETTINGS_TABS: { id: SettingsSection; label: string; tour: string; description: string }[] = [
  { id: 'account', label: 'Account Settings', tour: 'settings-account', description: 'Account Settings lets you manage your account information, subscription, and receipts.' },
  { id: 'companies', label: 'Company Settings', tour: 'settings-companies', description: 'Company Settings lets you manage your companies, tiers, and packages.' },
  { id: 'suppliers', label: 'Supplier Settings', tour: 'settings-suppliers', description: 'Supplier Settings select specific suppliers that will be available for your clients to choose from when booking.' },
  { id: 'calendar', label: 'Calendar Settings', tour: 'settings-calendar', description: 'Calendar Settings lets you manage appointment statuses, email templates, and calendar integrations.' },
  { id: 'email-settings', label: 'Email Settings', tour: 'settings-email-settings', description: 'Email Settings lets you connect Gmail, Outlook, Apple Mail, and Yahoo to your account.' },
  { id: 'bookings', label: 'Booking Settings', tour: 'settings-bookings', description: 'Booking Settings lets you manage your booking view, group name, statuses, and form templates.' },
  { id: 'email-templates', label: 'Email Templates', tour: 'settings-email-templates', description: 'Email Templates lets you manage your user and booking email templates.' },
  { id: 'permissions', label: 'Roles and Permissions', tour: 'settings-permissions', description: 'Roles and Permissions lets you manage your user\'s roles and permissions.' },
]

const ADMIN_TABS: { id: AdminSection; label: string; tour: string, description: string }[] = [
  { id: 'kyb', label: 'Company Verification', tour: 'admin-kyb', description: 'Company Verification lets you see each company that has been verified and their verification status.' },
  { id: 'emails', label: 'Admin Emails', tour: 'admin-emails', description: 'Admin Emails lets you see each company\'s sent emails and their status.' },
  { id: 'payouts', label: 'Payouts', tour: 'admin-payouts', description: 'Payouts lets you manage all the payouts that needs to be processed.' },
  { id: 'notifications', label: 'System Notifications', tour: 'admin-notifications', description: 'System Notifications lets you manage your system notifications and alerts.' },
  { id: 'support', label: 'Admin Support', tour: 'admin-support', description: 'Admin Support lets you see all the support requests and tickets that have been made.' },
]

const SIDEBAR_ITEMS: {
  feature: string
  label: string
  description: string
  tour: string
  path: string
}[] = [
  { feature: 'dashboard', label: 'Dashboard', tour: 'nav-dashboard', path: '/', description: 'Main menu: open Dashboard to work with this area of the app.' },
  { feature: 'calendar', label: 'Calendar', tour: 'nav-calendar', path: '/calendar', description: 'Calendar lets you manage your appointments and events.' },
  { feature: 'bookings', label: 'Bookings', tour: 'nav-bookings', path: '/bookings', description: 'Bookings simplifies the entire client booking process—from quotation to payment. Create and send professional quotations, accept online payments through secure payment links, and keep clients engaged with automated reminder emails.' },
  { feature: 'contacts', label: 'Contacts', tour: 'nav-contacts', path: '/contacts', description: 'Contacts lets you manage your clients and their contact information.' },
  { feature: 'users', label: 'Users', tour: 'nav-users', path: '/users', description: 'Users lets you manage your users and their permissions.' },
  { feature: 'emails', label: 'Emails', tour: 'nav-emails', path: '/emails', description: 'Emails lists all the emails sent by the system.' },
  {
    feature: 'file_manager',
    label: 'File Manager',
    tour: 'nav-file-manager',
    path: '/file-manager',
    description: 'File Manager lets you manage your important files and documents so everything you need is easily accessible. You can upload, download, and delete files here.',
  },
  {
    feature: 'template_studio',
    label: 'Invitations',
    tour: 'nav-invitations',
    path: '/invitations',
    description: 'Invitations lets you create and manage your event invitations and templates. You can customize the design, add widgets, and add RSVP forms to your invitations.',
  },
  { feature: 'reports', label: 'Reports', tour: 'nav-reports', path: '/reports', description: 'Reports provides a complete overview of your payments and transactions in one place. Easily track all payments received, monitor the status of each transaction, and gain valuable insights into your revenue. Stay informed with real-time payment updates, helping you manage cash flow and keep your business organized.' },
]

type AccordionTourDef = {
  tour: string
  title: string
  description: string
}

const SETTINGS_ACCORDIONS: Partial<Record<SettingsSection, AccordionTourDef[]>> = {
  companies: [
    {
      tour: 'settings-companies-companies',
      title: 'Companies',
      description: 'Manage companies linked to your account.',
    },
    {
      tour: 'settings-companies-tiers',
      title: 'Tiers',
      description: 'Configure pricing tiers for your companies.',
    },
    {
      tour: 'settings-companies-packages',
      title: 'Packages & Pricing',
      description: 'Set up packages and price points for bookings.',
    },
  ],
  calendar: [
    {
      tour: 'settings-calendar-statuses',
      title: 'Appointment statuses',
      description: 'Customize status labels and colors on the calendar.',
    },
    {
      tour: 'settings-calendar-email-templates',
      title: 'Email templates',
      description: 'Edit emails sent when appointments are created or updated.',
    },
    {
      tour: 'settings-calendar-integrations',
      title: 'Calendar Integrations',
      description: 'Connect Google, Microsoft, Apple, or Yahoo calendars to sync events.',
    },
  ],
  'email-settings': [
    {
      tour: 'settings-email-integrations',
      title: 'Email Integration',
      description: 'Connect Gmail, Outlook, Apple Mail, or Yahoo to send and receive email.',
    },
  ],
  bookings: [
    {
      tour: 'settings-bookings-view',
      title: 'Bookings view',
      description: 'Choose the default Board, Cards, or List layout for bookings.',
    },
    {
      tour: 'settings-bookings-group-name',
      title: 'Bookings group name',
      description: 'Rename the bookings group label shown when grouping fields or suppliers when creating a new booking.',
    },
    {
      tour: 'settings-bookings-statuses',
      title: 'Statuses',
      description: 'Manage kanban columns and booking status workflow.',
    },
    {
      tour: 'settings-bookings-form-templates',
      title: 'Form templates',
      description: 'Build custom fields and forms for new bookings.',
    },
  ],
  'email-templates': [
    {
      tour: 'settings-email-templates-users',
      title: 'User email templates',
      description: 'Templates for user-related emails such as password reset emails.',
    },
    {
      tour: 'settings-email-templates-bookings',
      title: 'Booking email templates',
      description: 'Templates for booking emails, payment links, and payment received emails.',
    },
  ],
}

const BOOKINGS_VIEW_STEPS: AccordionTourDef[] = [
  {
    tour: 'bookings-view-board',
    title: 'Board',
    description: 'Kanban columns for dragging bookings through your workflow.',
  },
  {
    tour: 'bookings-view-cards',
    title: 'Cards',
    description: 'A card grid for scanning many bookings at once.',
  },
  {
    tour: 'bookings-view-list',
    title: 'List',
    description: 'A sortable table with booking details in rows.',
  },
]

const INVITATIONS_STEPS: AccordionTourDef[] = [
  {
    tour: 'invitations-open-templates',
    title: 'Open templates',
    description: 'Browse all the invitations you have made in the past',
  },
  {
    tour: 'invitations-widgets-tool',
    title: 'Widgets',
    description: 'Open the widgets panel to add interactive blocks to your design.',
  },
  {
    tour: 'invitations-widget-countdown',
    title: 'Countdown',
    description: 'Add a countdown timer to your invitation page.',
  },
  {
    tour: 'invitations-widget-rsvp',
    title: 'RSVP',
    description: 'Add an RSVP form so guests can respond on your invitation.',
  },
]

const SUBSCRIPTION_SECTION_STEPS: AccordionTourDef[] = [
  {
    tour: 'subscription-current-plan',
    title: 'Current subscription',
    description: 'See your active plan, billing cycle, and seat usage.',
  },
  {
    tour: 'subscription-choose-plan',
    title: 'Choose plan',
    description: 'Compare plans and change your subscription.',
  },
  {
    tour: 'subscription-payment',
    title: 'Payment',
    description: 'Review billing details and complete checkout through PayMongo.',
  },
]

function step(
  tour: string,
  title: string,
  description: string,
  path?: string,
  popover?: Pick<TourStepMeta, 'popoverSide' | 'popoverAlign'>,
): TourStepMeta {
  return {
    element: `[data-tour="${tour}"]`,
    title,
    description,
    path,
    ...popover,
  }
}

function settingsTabPath(tab: SettingsSection): string {
  if (tab === 'account') return '/settings?tab=account'
  return `/settings?tab=${tab}`
}

function appendAccordionSteps(
  steps: TourStepMeta[],
  tab: SettingsSection,
  accordions: AccordionTourDef[],
) {
  const basePath = settingsTabPath(tab)
  for (const accordion of accordions) {
    steps.push(
      step(accordion.tour, accordion.title, accordion.description, basePath),
    )
  }
}

function appendAccountSettingsSteps(steps: TourStepMeta[]) {
  steps.push(
    step(
      'account-info',
      'Account information',
      'Update your account contact details and company-wide account fields here.',
      '/settings?tab=account&section=info',
    ),
    step(
      'account-subscription',
      'Subscription',
      'Choose a plan, manage billing, and schedule changes to your subscription.',
      '/settings?tab=account&section=subscription',
    ),
  )
  const subscriptionPath = '/settings?tab=account&section=subscription'
  for (const subStep of SUBSCRIPTION_SECTION_STEPS) {
    steps.push(
      step(subStep.tour, subStep.title, subStep.description, subscriptionPath),
    )
  }
  steps.push(
    step(
      'account-receipts',
      'Receipts',
      'Download PDF receipts for successful subscription payments.',
      '/settings?tab=account&section=receipts',
    ),
  )
}

export function shouldRunProductTour(user: UserRecord | null): boolean {
  if (!user) return false
  return !user.tour_completed_at
}

export function buildProductTourSteps(user: UserRecord): TourStepMeta[] {
  const steps: TourStepMeta[] = []

  steps.push(
    step(
      'nav-dashboard',
      'Welcome',
      'This tour walks through every menu and settings area. Use Next to continue. This is the dashboard where you will see charts and diagrams.',
      '/',
    ),
  )

  for (const item of SIDEBAR_ITEMS) {
    if (!canRead(user, item.feature)) continue
    if (item.tour === 'nav-dashboard') continue
    steps.push(
      step(
        item.tour,
        item.label,
        item.description,
        item.path,
      ),
    )

    if (item.tour === 'nav-bookings') {
      for (const viewStep of BOOKINGS_VIEW_STEPS) {
        const viewId = viewStep.tour.replace('bookings-view-', '')
        steps.push(
          step(
            viewStep.tour,
            viewStep.title,
            viewStep.description,
            `/bookings?view=${viewId}`,
          ),
        )
      }
    }

    if (item.tour === 'nav-invitations') {
      const invitationPaths: Record<string, string> = {
        'invitations-open-templates': '/invitations',
        'invitations-widgets-tool': '/invitations?tool=widgets',
        'invitations-widget-countdown': '/invitations?tool=widgets',
        'invitations-widget-rsvp': '/invitations?tool=widgets',
      }
      for (const invStep of INVITATIONS_STEPS) {
        steps.push(
          step(
            invStep.tour,
            invStep.title,
            invStep.description,
            invitationPaths[invStep.tour],
            invStep.tour.startsWith('invitations-widget') ||
            invStep.tour === 'invitations-widgets-tool'
              ? { popoverSide: 'right', popoverAlign: 'start' }
              : undefined,
          ),
        )
      }
    }
  }

  if (canAccessAnySettings(user)) {
    steps.push(
      step(
        'nav-settings',
        'Settings',
        'Account-wide configuration lives under Settings. We will walk through each section next.',
        '/settings',
      ),
    )

    for (const tab of SETTINGS_TABS) {
      if (!canAccessSettingsTab(user, tab.id)) continue
      const tabPath = settingsTabPath(tab.id)
      steps.push(
        step(
          tab.tour,
          tab.label,
          tab.description,
          tabPath,
          { popoverSide: 'right', popoverAlign: 'start' },
        ),
      )

      const accordions = SETTINGS_ACCORDIONS[tab.id]
      if (accordions) {
        appendAccordionSteps(steps, tab.id, accordions)
      }

      if (tab.id === 'account' && canAccessSettingsTab(user, 'account')) {
        appendAccountSettingsSteps(steps)
      }
    }
  }

  if (canAccessAnyAdminTab(user)) {
    steps.push(
      step(
        'nav-admin',
        'Admin',
        'Platform admin tools for verification, email, payouts, and support.',
        '/admin',
      ),
    )
    for (const tab of ADMIN_TABS) {
      if (!canAccessAdminTab(user, tab.id)) continue
      const tabPath = tab.id === 'kyb' ? '/admin' : `/admin?tab=${tab.id}`
      steps.push(
        step(
          tab.tour,
          tab.label,
          `Admin section: ${tab.label}.`,
          tabPath,
        ),
      )
    }
  }

  steps.push(
    step(
      'nav-profile',
      'Your account menu',
      'Open this menu to edit your profile, get support, or sign out.',
    ),
    step(
      'profile-nav-profile',
      'Edit profile',
      'Update your name, email, username, and profile photo.',
      '/profile',
      { popoverSide: 'right', popoverAlign: 'start' },
    ),
    step(
      'profile-nav-password',
      'Reset password',
      'Change your password when you are signed in.',
      '/profile?tab=password',
      { popoverSide: 'right', popoverAlign: 'start' },
    ),
    step(
      'profile-nav-support',
      'Support',
      'Open a support request or find help contact options here.',
      '/profile?tab=support',
      { popoverSide: 'right', popoverAlign: 'start' },
    ),
  )

  if (canRead(user, 'reports')) {
    steps.push(
      step(
        'reports-payouts',
        'Report payouts',
        'View payout reports for your account.',
        '/reports',
      ),
    )
  }

  steps.push(
    step(
      'tour-finish',
      'You are all set',
      'Use the sidebar and settings menus anytime. You can replay this tour later from Edit Profile.',
      '/',
    ),
  )

  return steps
}
