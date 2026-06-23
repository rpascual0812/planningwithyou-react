import type {
  PublicRsvpAnalytics,
  PublicRsvpBreakdownItem,
} from '../../../../services/templateStudioApi'

const BREAKDOWN_COLORS: Record<string, string> = {
  will_go: '#2f7d57',
  will_not_go: '#c94f4f',
  awaiting_reply: '#c9a96e',
}

const STAT_CARDS = [
  {
    key: 'total_views',
    label: 'Total views',
    icon: 'bi-eye',
    tone: 'neutral',
    value: (analytics: PublicRsvpAnalytics) => analytics.total_views,
  },
  {
    key: 'expected_visitors',
    label: 'Expected number of visitors',
    icon: 'bi-people',
    tone: 'neutral',
    value: (analytics: PublicRsvpAnalytics) => analytics.expected_visitors,
  },
  {
    key: 'days_remaining',
    label: 'Days remaining to accept RSVP',
    icon: 'bi-calendar-event',
    tone: 'neutral',
    value: (analytics: PublicRsvpAnalytics) =>
      analytics.days_remaining == null ? '—' : analytics.days_remaining,
  },
  {
    key: 'will_go',
    label: 'Will go',
    icon: 'bi-check-lg',
    tone: 'success',
    value: (analytics: PublicRsvpAnalytics) => analytics.will_go,
  },
  {
    key: 'will_not_go',
    label: 'Will not go',
    icon: 'bi-x-lg',
    tone: 'danger',
    value: (analytics: PublicRsvpAnalytics) => analytics.will_not_go,
  },
  {
    key: 'awaiting_reply',
    label: 'Awaiting reply',
    icon: 'bi-clock',
    tone: 'neutral',
    value: (analytics: PublicRsvpAnalytics) => analytics.awaiting_reply,
  },
] as const

function donutBackground(analytics: PublicRsvpAnalytics): string {
  const segments = analytics.breakdown.filter((item: PublicRsvpBreakdownItem) => item.count > 0)
  const total = segments.reduce((sum: number, item: PublicRsvpBreakdownItem) => sum + item.count, 0)
  if (total <= 0) {
    return '#ece7df'
  }

  let offset = 0
  const stops = segments.map((item: PublicRsvpBreakdownItem) => {
    const start = (offset / total) * 100
    offset += item.count
    const end = (offset / total) * 100
    const color = BREAKDOWN_COLORS[item.key] ?? '#c9a96e'
    return `${color} ${start}% ${end}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

type PublicRsvpAnalyticsPanelProps = {
  analytics: PublicRsvpAnalytics
}

const PublicRsvpAnalyticsPanel = ({ analytics }: PublicRsvpAnalyticsPanelProps) => {
  const donutStyle = donutBackground(analytics)

  return (
    <section className="public-rsvp-analytics" aria-label="RSVP analytics">
      <div className="public-rsvp-analytics__grid">
        {STAT_CARDS.map((card) => (
          <article key={card.key} className={`public-rsvp-stat public-rsvp-stat--${card.tone}`}>
            <span className={`public-rsvp-stat__icon bi ${card.icon}`} aria-hidden="true" />
            <p className="public-rsvp-stat__value">{card.value(analytics)}</p>
            <p className="public-rsvp-stat__label">{card.label}</p>
          </article>
        ))}
      </div>

      <article className="public-rsvp-breakdown">
        <h2 className="public-rsvp-breakdown__title">RSVP breakdown</h2>
        <div className="public-rsvp-breakdown__body">
          <div
            className="public-rsvp-donut"
            style={{ background: donutStyle }}
            role="img"
            aria-label={`RSVP breakdown for ${analytics.total_guests} guests`}
          >
            <div className="public-rsvp-donut__center">
              <strong>{analytics.total_guests}</strong>
              <span>guests</span>
            </div>
          </div>

          <ul className="public-rsvp-breakdown__legend">
            {analytics.breakdown.map((item) => (
              <li key={item.key}>
                <span
                  className="public-rsvp-breakdown__dot"
                  style={{ background: BREAKDOWN_COLORS[item.key] ?? '#c9a96e' }}
                  aria-hidden="true"
                />
                <span className="public-rsvp-breakdown__name">{item.label}</span>
                <span className="public-rsvp-breakdown__meta">
                  {item.count} ({item.percent}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </section>
  )
}

export default PublicRsvpAnalyticsPanel
