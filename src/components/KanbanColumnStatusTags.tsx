import type { BookingStatusTagRecord } from '../services/bookings'

type KanbanColumnStatusTagsProps = {
  tags?: BookingStatusTagRecord[]
}

const KanbanColumnStatusTags = ({ tags }: KanbanColumnStatusTagsProps) => {
  if (!tags?.length) return null

  return (
    <div className="kanban-column-tags" aria-label="Status tags">
      {tags.map((t) => (
        <span key={t.id} className="badge kanban-column-tag">
          {t.tag}
        </span>
      ))}
    </div>
  )
}

export default KanbanColumnStatusTags
