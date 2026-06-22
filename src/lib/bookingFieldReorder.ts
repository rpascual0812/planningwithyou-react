import { normalizeBookingGroupName } from './bookingFieldGroups'
import type { BookingField } from './bookingFieldTypes'

/** Insert ``sourceIdx`` before ``targetIdx``, assigning the field to ``targetGroupName``. */
export function applyBookingFieldMove(
  fields: BookingField[],
  sourceIdx: number,
  targetIdx: number,
  targetGroupName: string,
  groupIdByName: Map<string, number>,
): BookingField[] {
  if (sourceIdx === targetIdx) return fields

  const norm = normalizeBookingGroupName(targetGroupName)
  const quotation_group_id = groupIdByName.get(norm) ?? null
  const next = [...fields]
  const [moved] = next.splice(sourceIdx, 1)
  const adjustedTarget = sourceIdx < targetIdx ? targetIdx - 1 : targetIdx
  const updated: BookingField = {
    ...moved,
    group_name: norm,
    quotation_group_id,
  }
  next.splice(adjustedTarget, 0, updated)
  return next.map((f, i) => ({ ...f, sort_order: i }))
}

/** Move a field to the end of ``targetGroupName`` (supports empty groups). */
export function applyBookingFieldMoveToGroupEnd(
  fields: BookingField[],
  sourceIdx: number,
  targetGroupName: string,
  groupIdByName: Map<string, number>,
): BookingField[] {
  const norm = normalizeBookingGroupName(targetGroupName)
  const quotation_group_id = groupIdByName.get(norm) ?? null
  const next = [...fields]
  const [moved] = next.splice(sourceIdx, 1)
  const updated: BookingField = {
    ...moved,
    group_name: norm,
    quotation_group_id,
  }

  let insertAt = next.length
  for (let i = next.length - 1; i >= 0; i--) {
    if (normalizeBookingGroupName(next[i].group_name) === norm) {
      insertAt = i + 1
      break
    }
  }

  next.splice(insertAt, 0, updated)
  return next.map((f, i) => ({ ...f, sort_order: i }))
}
