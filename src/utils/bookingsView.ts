export type BookingsView = 'board' | 'cards' | 'list'

export const BOOKINGS_VIEW_OPTIONS: { id: BookingsView; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'cards', label: 'Cards' },
  { id: 'list', label: 'List' },
]

export const BOOKING_VIEW_DEFAULT: BookingsView = 'board'

export function isBookingsView(value: string | null | undefined): value is BookingsView {
  return value === 'board' || value === 'cards' || value === 'list'
}
