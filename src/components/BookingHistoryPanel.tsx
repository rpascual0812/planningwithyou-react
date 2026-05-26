import ResourceHistoryPanel from './ResourceHistoryPanel'
import { historyPaths } from '../services/history'

type Props = {
  bookingId: number
  refreshKey?: number
}

const BookingHistoryPanel = ({ bookingId, refreshKey = 0 }: Props) => (
  <ResourceHistoryPanel
    historyPath={historyPaths.bookingItem(bookingId)}
    bookingMode
    refreshKey={refreshKey}
  />
)

export default BookingHistoryPanel
