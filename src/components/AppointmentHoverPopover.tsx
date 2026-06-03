import { forwardRef, type MouseEvent } from 'react'
import { REPEAT_TYPE_OPTIONS } from '../services/calendar'

export type AppointmentHoverDetails = {
  eventId: number
  title: string
  startLabel: string
  endLabel: string
  durationLabel: string
  statusTitle?: string
  statusBackgroundColor?: string
  statusTextColor?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  bookingLabel?: string
  repeatLabel?: string
}

type AppointmentHoverPopoverProps = {
  details: AppointmentHoverDetails
  style: { top: number; left: number }
  onMouseEnter: () => void
  onMouseLeave: (e: MouseEvent<HTMLDivElement>) => void
}

function DetailRow({
  icon,
  label,
  value,
  href,
}: {
  icon: string
  label: string
  value: string
  href?: string
}) {
  if (!value) return null
  return (
    <div className="appointment-popover__row">
      <span className="appointment-popover__row-icon" aria-hidden="true">
        <i className={`bi ${icon}`} />
      </span>
      <div className="appointment-popover__row-body">
        <span className="appointment-popover__row-label">{label}</span>
        {href ? (
          <a className="appointment-popover__row-value appointment-popover__row-value--link" href={href}>
            {value}
          </a>
        ) : (
          <span className="appointment-popover__row-value">{value}</span>
        )}
      </div>
    </div>
  )
}

const AppointmentHoverPopover = forwardRef<HTMLDivElement, AppointmentHoverPopoverProps>(
  function AppointmentHoverPopover(
    { details, style, onMouseEnter, onMouseLeave },
    ref,
  ) {
    const headerStyle = details.statusBackgroundColor
      ? {
          background: `linear-gradient(135deg, ${details.statusBackgroundColor} 0%, color-mix(in srgb, ${details.statusBackgroundColor} 75%, #1f3a5f) 100%)`,
          color: details.statusTextColor ?? '#fff',
        }
      : undefined

    return (
      <div
        ref={ref}
        className="appointment-popover"
        style={style}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="appointment-popover__card" role="tooltip">
          <div className="appointment-popover__header" style={headerStyle}>
            <div className="appointment-popover__header-icon" aria-hidden="true">
              <i className="bi bi-calendar-event" />
            </div>
            <div className="appointment-popover__header-text">
              <span className="appointment-popover__eyebrow">Appointment</span>
              <strong className="appointment-popover__title">{details.title}</strong>
              {details.statusTitle && (
                <span className="appointment-popover__status">{details.statusTitle}</span>
              )}
            </div>
          </div>

          <div className="appointment-popover__body">
            <DetailRow icon="bi-clock" label="Starts" value={details.startLabel} />
            <DetailRow icon="bi-clock-history" label="Ends" value={details.endLabel} />
            <DetailRow icon="bi-hourglass-split" label="Duration" value={details.durationLabel} />
            {details.repeatLabel && (
              <DetailRow icon="bi-arrow-repeat" label="Repeats" value={details.repeatLabel} />
            )}
            {details.contactName && (
              <DetailRow icon="bi-person" label="Contact" value={details.contactName} />
            )}
            {details.contactEmail && (
              <DetailRow
                icon="bi-envelope"
                label="Email"
                value={details.contactEmail}
                href={`mailto:${details.contactEmail}`}
              />
            )}
            {details.contactPhone && (
              <DetailRow
                icon="bi-telephone"
                label="Phone"
                value={details.contactPhone}
                href={`tel:${details.contactPhone.replace(/\s/g, '')}`}
              />
            )}
            {details.bookingLabel && (
              <DetailRow icon="bi-journal-bookmark" label="Quotation" value={details.bookingLabel} />
            )}
          </div>

          <div className="appointment-popover__footer">
            <i className="bi bi-cursor" aria-hidden="true" />
            <span>Click to view or edit</span>
          </div>
        </div>
      </div>
    )
  },
)

export default AppointmentHoverPopover

export function repeatLabelForType(
  repeatType: string | null,
  repeatEnd: string | null,
): string | undefined {
  if (!repeatType) return undefined
  const option = REPEAT_TYPE_OPTIONS.find((o) => o.value === repeatType)
  const base = option?.label ?? repeatType
  if (!repeatEnd) return base
  const end = new Date(repeatEnd)
  if (Number.isNaN(end.getTime())) return base
  return `${base} until ${end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
}

export function formatAppointmentDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime()
  if (ms <= 0) return '—'
  const totalMinutes = Math.round(ms / 60_000)
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  }
  return `${hours} hr ${minutes} min`
}
