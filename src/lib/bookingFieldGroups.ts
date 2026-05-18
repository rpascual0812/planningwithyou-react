import type { BookingField } from '../components/BookingEditModal'

export const DEFAULT_BOOKING_GROUP_NAME = 'Suppliers'

export function normalizeBookingGroupName(name: string | undefined): string {
  const trimmed = name?.trim()
  return trimmed || DEFAULT_BOOKING_GROUP_NAME
}

export type BookingFieldGroup = {
  groupName: string
  items: { field: BookingField; idx: number }[]
}

export function groupBookingFieldsByGroupName(
  fields: BookingField[],
): BookingFieldGroup[] {
  const order: string[] = []
  const map = new Map<string, { field: BookingField; idx: number }[]>()

  fields.forEach((field, idx) => {
    const groupName = normalizeBookingGroupName(field.group_name)
    if (!map.has(groupName)) {
      map.set(groupName, [])
      order.push(groupName)
    }
    map.get(groupName)!.push({ field, idx })
  })

  return order.map((groupName) => ({
    groupName,
    items: map.get(groupName)!,
  }))
}

/** Field groups plus empty groups from the API or created in the booking editor. */
export function mergeBookingFieldGroups(
  fields: BookingField[],
  extraGroupNames: string[],
  apiGroups: { id: number; name: string }[] = [],
): BookingFieldGroup[] {
  const groups = groupBookingFieldsByGroupName(fields)
  const existing = new Set(groups.map((g) => g.groupName))

  for (const apiGroup of apiGroups) {
    const groupName = normalizeBookingGroupName(apiGroup.name)
    if (!existing.has(groupName)) {
      groups.push({ groupName, items: [] })
      existing.add(groupName)
    }
  }

  for (const raw of extraGroupNames) {
    const groupName = normalizeBookingGroupName(raw)
    if (!existing.has(groupName)) {
      groups.push({ groupName, items: [] })
      existing.add(groupName)
    }
  }

  return groups
}

/** Names of all groups to persist (fields + empty accordions). */
export function buildBookingGroupsPayload(
  fields: BookingField[],
  extraGroupNames: string[] = [],
): { name: string }[] {
  const names = new Set<string>()
  for (const field of fields) {
    if (field.saved) {
      names.add(normalizeBookingGroupName(field.group_name))
    }
  }
  for (const raw of extraGroupNames) {
    names.add(normalizeBookingGroupName(raw))
  }
  return [...names].map((name) => ({ name }))
}

export function emptyBookingGroupNamesFromItem(
  fieldValues: { group_name?: string }[],
  apiGroups: { name: string }[] = [],
): string[] {
  const withFields = new Set(
    fieldValues.map((fv) => normalizeBookingGroupName(fv.group_name)),
  )
  return apiGroups
    .map((g) => normalizeBookingGroupName(g.name))
    .filter((name) => !withFields.has(name))
}
