import type { BookingsView } from '../utils/bookingsView'

type BookingsViewPlaceholderProps = {
  view: BookingsView
}

const SkeletonBar = ({
  className = '',
}: {
  className?: string
}) => <span className={`bookings-view-skeleton-bar${className ? ` ${className}` : ''}`} />

const CardSkeleton = () => (
  <div className="bookings-view-preview-card">
    <SkeletonBar className="is-title" />
    <SkeletonBar className="is-line is-long" />
    <SkeletonBar className="is-line is-medium" />
    <SkeletonBar className="is-line is-short" />
    <SkeletonBar className="is-thumb" />
  </div>
)

const CardsPreview = () => (
  <div className="bookings-view-preview-cards-grid">
    {Array.from({ length: 4 }, (_, index) => (
      <CardSkeleton key={index} />
    ))}
  </div>
)

const BoardPreview = () => (
  <div className="bookings-view-preview-board">
    {['To do', 'In progress', 'Done'].map((label) => (
      <div key={label} className="bookings-view-preview-column">
        <SkeletonBar className="is-col-title" />
        <div className="bookings-view-preview-column-card">
          <SkeletonBar className="is-line is-medium" />
          <SkeletonBar className="is-line is-short" />
        </div>
        <div className="bookings-view-preview-column-card is-muted">
          <SkeletonBar className="is-line is-short" />
        </div>
      </div>
    ))}
  </div>
)

const ListPreview = () => (
  <div className="bookings-view-preview-list">
    {[0, 1, 2].map((row) => (
      <div key={row} className="bookings-view-preview-list-row">
        <SkeletonBar className="is-avatar" />
        <div className="bookings-view-preview-list-lines">
          <SkeletonBar className="is-line is-medium" />
          <SkeletonBar className="is-line is-short" />
        </div>
        <SkeletonBar className="is-pill" />
      </div>
    ))}
  </div>
)

const BookingsViewPlaceholder = ({ view }: BookingsViewPlaceholderProps) => (
  <div
    className="bookings-view-preview"
    aria-hidden="true"
    data-view={view}
  >
    {view === 'board' && <BoardPreview />}
    {view === 'cards' && <CardsPreview />}
    {view === 'list' && <ListPreview />}
  </div>
)

export default BookingsViewPlaceholder
