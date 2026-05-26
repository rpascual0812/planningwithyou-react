import { fetchHistory, historyPaths, type HistoryRecord } from './history'

export type BookingHistoryRecord = HistoryRecord

export async function fetchBookingHistory(
  bookingId: number,
): Promise<BookingHistoryRecord[]> {
  return fetchHistory(historyPaths.bookingItem(bookingId))
}
