import { useCallback, useEffect, useState } from 'react'
import ListShowMoreFooter from './ListShowMoreFooter'
import { useVisibleListSlice } from '../hooks/useVisibleListSlice'
import { describeHistoryEntry } from '../lib/bookingHistoryDisplay'
import { describeResourceHistoryEntry } from '../lib/resourceHistoryDisplay'
import { fetchHistory, type HistoryRecord } from '../services/history'

type Props = {
  historyPath: string
  /** When true, use booking-specific labels (lines, groups, etc.). */
  bookingMode?: boolean
  refreshKey?: number
}

function describeEntry(entry: HistoryRecord, bookingMode: boolean) {
  if (
    bookingMode
    || entry.entity_type === 'quotation'
    || entry.entity_type === 'quotation_item'
    || entry.entity_type === 'quotation_group'
    || entry.entity_type === 'quotation_document'
  ) {
    return describeHistoryEntry(entry as never)
  }
  return describeResourceHistoryEntry(entry)
}

const ResourceHistoryPanel = ({
  historyPath,
  bookingMode = false,
  refreshKey = 0,
}: Props) => {
  const [rows, setRows] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHistory(historyPath)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [historyPath])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const { visible: visibleRows, hiddenCount, showMore } = useVisibleListSlice(
    rows,
    [refreshKey, historyPath],
  )

  if (loading) {
    return (
      <div className="booking-history-panel text-muted small py-4 text-center">
        Loading history…
      </div>
    )
  }

  if (error) {
    return (
      <div className="booking-history-panel">
        <p className="text-danger small mb-2" role="alert">
          {error}
        </p>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void load()}>
          Retry
        </button>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="booking-history-panel text-muted small py-4 text-center">
        No changes recorded yet.
      </div>
    )
  }

  return (
    <div className="booking-history-panel">
      <ul className="booking-history-list list-unstyled mb-0">
        {visibleRows.map((entry) => {
          const { title, details, timestamp } = describeEntry(entry, bookingMode)
          return (
            <li key={entry.id} className="booking-history-item">
              <div className="booking-history-item__header">
                <span className="booking-history-item__title">{title}</span>
                <time className="booking-history-item__time" dateTime={entry.created_at}>
                  {timestamp}
                </time>
              </div>
              {details.length > 0 && (
                <ul className="booking-history-item__details list-unstyled mb-0">
                  {details.map((line, idx) => (
                    <li key={`${entry.id}-${idx}`}>{line}</li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      <ListShowMoreFooter hiddenCount={hiddenCount} onShowMore={showMore} />
    </div>
  )
}

export default ResourceHistoryPanel
