type Props = {
  hiddenCount: number
  onShowMore: () => void
  className?: string
}

export default function ListShowMoreFooter({
  hiddenCount,
  onShowMore,
  className = '',
}: Props) {
  if (hiddenCount <= 0) return null

  return (
    <div
      className={`panel-list-show-more-footer${className ? ` ${className}` : ''}`}
    >
      <button
        type="button"
        className="btn btn-link panel-list-show-more"
        onClick={onShowMore}
      >
        Show more
        <span className="panel-list-show-more__count">({hiddenCount} more)</span>
      </button>
    </div>
  )
}
