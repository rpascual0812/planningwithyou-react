import type { HistoryRecord } from '../services/history'
import { formatHistoryTimestamp } from './bookingHistoryDisplay'

const FIELD_LABELS: Record<string, Record<string, string>> = {
  account: {
    name: 'Name',
    is_active: 'Active',
    contact_person: 'Contact person',
    contact_email: 'Contact email',
    contact_mobile_number: 'Mobile',
    timezone: 'Timezone',
    country_id: 'Country',
  },
  company: {
    name: 'Name',
    supplier_type_id: 'Supplier type',
    timezone: 'Timezone',
    contact_person: 'Contact person',
    phone_number: 'Phone',
    mobile_number: 'Mobile',
    address: 'Address',
    website: 'Website',
    is_active: 'Active',
    is_main: 'Main company',
    max_bookings_per_day: 'Max bookings per day',
    logo: 'Logo',
  },
  user: {
    username: 'Username',
    email: 'Email',
    first_name: 'First name',
    last_name: 'Last name',
    is_active: 'Active',
    role: 'Role',
    company_id: 'Company',
  },
  contact: {
    first_name: 'First name',
    last_name: 'Last name',
    email: 'Email',
    company_org_id: 'Company',
    notes: 'Notes',
  },
  booking_status: {
    title: 'Title',
    description: 'Description',
    color: 'Color',
    sort_order: 'Sort order',
  },
  email_template: {
    name: 'Name',
    title: 'Title',
    subject: 'Subject',
    body: 'Body',
    is_active: 'Active',
    company_id: 'Company',
    template_type: 'Type',
  },
  form_template: {
    name: 'Name',
    description: 'Description',
    is_active: 'Active',
    is_default: 'Default',
    company_id: 'Company',
  },
}

const RESOURCE_LABELS: Record<string, string> = {
  account: 'account',
  company: 'company',
  user: 'user',
  contact: 'contact',
  booking_status: 'status',
  email_template: 'email template',
  form_template: 'form template',
  supplier_setting: 'supplier setting',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function fieldChangeLines(
  changes: Record<string, { old?: unknown; new?: unknown }>,
  labels: Record<string, string>,
): string[] {
  return Object.entries(changes).map(([key, delta]) => {
    const label = labels[key] ?? key
    return `${label}: ${formatValue(delta.old)} → ${formatValue(delta.new)}`
  })
}

function resourceActionTitle(entry: HistoryRecord): string {
  const who = entry.actor_name?.trim() || 'System'
  const label = RESOURCE_LABELS[entry.resource_type] ?? entry.resource_type
  switch (entry.action) {
    case 'create':
      return `${who} created this ${label}`
    case 'delete':
      return `${who} deleted this ${label}`
    case 'replace':
      return `${who} replaced ${label} data`
    case 'update':
    default:
      return `${who} updated this ${label}`
  }
}

function summarizeSupplierSetting(entry: HistoryRecord): string[] {
  const lines: string[] = []
  const changes = entry.changes
  if (changes.is_active && typeof changes.is_active === 'object') {
    const delta = changes.is_active as { old?: unknown; new?: unknown }
    lines.push(`Active: ${formatValue(delta.old)} → ${formatValue(delta.new)}`)
  }
  if (changes.supplier_name && typeof changes.supplier_name === 'object') {
    const delta = changes.supplier_name as { old?: unknown; new?: unknown }
    lines.push(`Name: ${formatValue(delta.old)} → ${formatValue(delta.new)}`)
  }
  const tiers = changes.tiers
  if (Array.isArray(tiers) && tiers.length > 0) {
    lines.push(`Tier pricing updated (${tiers.length} tier${tiers.length === 1 ? '' : 's'})`)
  }
  return lines
}

function summarizeNestedRows(
  key: string,
  block: { added?: unknown[]; removed?: unknown[] } | undefined,
): string[] {
  if (!block) return []
  const lines: string[] = []
  const added = block.added ?? []
  const removed = block.removed ?? []

  const formatNames = (items: unknown[]): string | null => {
    const names = items.filter((x) => typeof x === 'string' && x.trim()) as string[]
    if (names.length === 0) return null
    const max = 6
    const head = names.slice(0, max)
    const more = names.length > max ? ` (+${names.length - max} more)` : ''
    return `${head.join(', ')}${more}`
  }

  if (added.length) {
    const names = formatNames(added)
    lines.push(names ? `${key} added: ${names}` : `${key} added: ${added.length}`)
  }
  if (removed.length) {
    const names = formatNames(removed)
    lines.push(names ? `${key} removed: ${names}` : `${key} removed: ${removed.length}`)
  }
  return lines
}

export function describeResourceHistoryEntry(entry: HistoryRecord): {
  title: string
  details: string[]
  timestamp: string
} {
  const labels = FIELD_LABELS[entry.resource_type] ?? {}
  const lines: string[] = []
  const changes = entry.changes

  if (entry.resource_type === 'supplier_setting') {
    return {
      title: resourceActionTitle(entry),
      details: summarizeSupplierSetting(entry),
      timestamp: formatHistoryTimestamp(entry.created_at),
    }
  }

  if (entry.action === 'create' && changes.snapshot && typeof changes.snapshot === 'object') {
    const snap = changes.snapshot as Record<string, unknown>
    const name = snap.name ?? snap.title ?? snap.email ?? snap.username
    if (name) lines.push(`Name: ${formatValue(name)}`)
  } else if (changes.fields && typeof changes.fields === 'object') {
    lines.push(
      ...fieldChangeLines(
        changes.fields as Record<string, { old?: unknown; new?: unknown }>,
        labels,
      ),
    )
  }

  if (entry.resource_type === 'contact') {
    lines.push(...summarizeNestedRows('Phone numbers', changes.phone_numbers as never))
    lines.push(...summarizeNestedRows('Addresses', changes.addresses as never))
  }
  if (entry.resource_type === 'form_template') {
    lines.push(...summarizeNestedRows('Fields', changes.template_fields as never))
  }

  if (entry.action === 'delete') {
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'fields') continue
      const label = labels[key] ?? key
      lines.push(`${label}: ${formatValue(value)}`)
    }
  }

  return {
    title: resourceActionTitle(entry),
    details: lines,
    timestamp: formatHistoryTimestamp(entry.created_at),
  }
}
