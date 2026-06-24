import type { HistoryRecord } from '../services/history'

const BOOKING_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  status_id: 'Status',
  contact_id: 'Contact',
  date_of_event: 'Date of event',
  total_amount: 'Total amount',
  required_downpayment_amount: 'Required downpayment',
  notes: 'Notes',
  sort_order: 'Sort order',
}

const LINE_FIELD_LABELS: Record<string, string> = {
  label: 'Label',
  group_name: 'Group',
  field_type: 'Field type',
  is_required: 'Required',
  price: 'Price',
  required_downpayment: 'Downpayment',
  value: 'Value',
  company_id: 'Supplier',
  package_id: 'Package',
  package_version_id: 'Package',
  sort_order: 'Order',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function actionTitle(entry: HistoryRecord): string {
  const who = entry.actor_name?.trim() || 'System'
  if (entry.entity_type === 'quotation_document') {
    switch (entry.action) {
      case 'create':
        return `${who} added a document`
      case 'delete':
        return `${who} removed a document`
      default:
        return `${who} updated a document`
    }
  }
  switch (entry.action) {
    case 'create':
      return `${who} created this quotation`
    case 'delete':
      if (entry.entity_type === 'quotation_group') return `${who} removed a group`
      if (entry.entity_type === 'quotation') return `${who} deleted this quotation`
      return `${who} removed an item`
    case 'replace':
      return `${who} updated quotation fields`
    case 'update':
    default:
      if (entry.entity_type === 'quotation_group') return `${who} updated a group`
      return `${who} updated this quotation`
  }
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

function summarizeChanges(entry: HistoryRecord): string[] {
  const lines: string[] = []
  const changes = entry.changes

  if (entry.action === 'create' && changes.snapshot && typeof changes.snapshot === 'object') {
    const snap = changes.snapshot as { booking?: { title?: string } }
    const title = snap.booking?.title
    if (title) lines.push(`Title: ${formatValue(title)}`)
    return lines
  }

  if (entry.entity_type === 'quotation_group' && typeof changes.name === 'string') {
    lines.push(`Group: ${changes.name}`)
    return lines
  }

  if (entry.entity_type === 'quotation_document') {
    if (typeof changes.name === 'string') {
      lines.push(`File: ${changes.name}`)
    }
    if (changes.source === 'file_manager' && changes.source_document_name) {
      lines.push(`From File Manager: ${formatValue(changes.source_document_name)}`)
    } else if (changes.source === 'upload') {
      lines.push('Source: uploaded to quotation')
    }
    return lines
  }

  if (entry.action === 'delete' && entry.entity_type === 'quotation') {
    if (changes.unique_id) lines.push(`Quotation ID: ${formatValue(changes.unique_id)}`)
    if (changes.title) lines.push(`Title: ${formatValue(changes.title)}`)
    return lines
  }

  const quotation = changes.quotation
  if (quotation && typeof quotation === 'object') {
    lines.push(
      ...fieldChangeLines(
        quotation as Record<string, { old?: unknown; new?: unknown }>,
        BOOKING_FIELD_LABELS,
      ),
    )
  }

  const groups = changes.groups
  if (groups && typeof groups === 'object') {
    const g = groups as { added?: string[]; removed?: string[] }
    if (g.added?.length) lines.push(`Groups added: ${g.added.join(', ')}`)
    if (g.removed?.length) lines.push(`Groups removed: ${g.removed.join(', ')}`)
  }

  const lineChanges = changes.lines
  if (lineChanges && typeof lineChanges === 'object') {
    const lc = lineChanges as {
      added?: { label?: string; group_name?: string }[]
      removed?: { label?: string; group_name?: string }[]
      changed?: {
        label?: string
        group_name?: string
        fields?: Record<string, { old?: unknown; new?: unknown }>
      }[]
    }
    for (const row of lc.added ?? []) {
      const name = [row.group_name, row.label].filter(Boolean).join(' · ')
      if (name) lines.push(`Added line: ${name}`)
    }
    for (const row of lc.removed ?? []) {
      const name = [row.group_name, row.label].filter(Boolean).join(' · ')
      if (name) lines.push(`Removed line: ${name}`)
    }
    for (const row of lc.changed ?? []) {
      const prefix = [row.group_name, row.label].filter(Boolean).join(' · ')
      const fieldLines = fieldChangeLines(
        (row.fields ?? {}) as Record<string, { old?: unknown; new?: unknown }>,
        LINE_FIELD_LABELS,
      )
      for (const fl of fieldLines) {
        lines.push(prefix ? `${prefix} — ${fl}` : fl)
      }
    }
  }

  return lines
}

import { getActiveAppTimeZone } from './appTimezone'

export function formatHistoryTimestamp(
  iso: string,
  timeZone?: string,
): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const tz = (timeZone ?? getActiveAppTimeZone())?.trim()
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
  if (!tz) return d.toLocaleString(undefined, opts)
  try {
    return d.toLocaleString(undefined, { ...opts, timeZone: tz })
  } catch {
    return d.toLocaleString(undefined, opts)
  }
}

export function describeHistoryEntry(entry: HistoryRecord): {
  title: string
  details: string[]
  timestamp: string
} {
  const details = summarizeChanges(entry)
  return {
    title: actionTitle(entry),
    details,
    timestamp: formatHistoryTimestamp(entry.created_at),
  }
}
