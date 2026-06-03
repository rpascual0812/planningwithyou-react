type KanbanBoardLoadingPlaceholderProps = {
  columns?: number
}

const SkeletonBar = ({ className = '' }: { className?: string }) => (
  <span className={`kanban-skeleton-bar${className ? ` ${className}` : ''}`} />
)

const KanbanCardSkeleton = ({ short = false }: { short?: boolean }) => (
  <div className={`kanban-card kanban-card--skeleton${short ? ' is-short' : ''}`}>
    <SkeletonBar className="kanban-skeleton-bar--strip" />
    <div className="kanban-card-body">
      <SkeletonBar className="kanban-skeleton-bar--id" />
      <SkeletonBar className="kanban-skeleton-bar--title" />
      {!short && <SkeletonBar className="kanban-skeleton-bar--line" />}
    </div>
  </div>
)

const KanbanBoardLoadingPlaceholder = ({
  columns = 3,
}: KanbanBoardLoadingPlaceholderProps) => (
  <div
    className="kanban-board kanban-board--loading"
    role="status"
    aria-busy="true"
    aria-label="Loading board"
  >
    <span className="visually-hidden">Loading quotations…</span>
    {Array.from({ length: columns }, (_, index) => (
      <section
        key={index}
        className="kanban-column kanban-column--skeleton"
        aria-hidden="true"
      >
        <header className="kanban-column-header">
          <SkeletonBar className="kanban-skeleton-bar--col-title" />
        </header>
        <div className="kanban-column-cards kanban-column-cards--scroll">
          <KanbanCardSkeleton />
          <KanbanCardSkeleton short />
        </div>
      </section>
    ))}
  </div>
)

export default KanbanBoardLoadingPlaceholder
