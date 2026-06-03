import { Link } from 'react-router-dom'
import type {
  DashboardCompanySummary,
  DashboardStatusCount,
} from '../../services/dashboard'

const TONES = ['navy', 'green', 'red'] as const
const STATUS_VARIANTS = ['running', 'completed', 'pending'] as const
const PROJECT_ICONS = [
  'dash-project-icon--orange',
  'dash-project-icon--blue',
  'dash-project-icon--green',
  'dash-project-icon--pink',
  'dash-project-icon--navy',
  'dash-project-icon--cyan',
] as const

function parseAmount(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isNaN(n) ? 0 : n
}

export function formatMoney(value: string | number): string {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatEventDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatEventWeekday(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)
}

function countsToSparklinePath(counts: number[]): string {
  if (counts.length === 0) return 'M0 36 L100 36'
  const max = Math.max(...counts, 1)
  if (counts.length === 1) {
    const y = 36 - (counts[0] / max) * 26
    return `M0 ${y} L100 ${y}`
  }
  return counts
    .map((count, index) => {
      const x = (index / (counts.length - 1)) * 100
      const y = 36 - (count / max) * 26
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function collectionDonutStyle(paid: number, remaining: number, pending: number): string {
  const total = paid + remaining + pending
  if (total <= 0) return 'conic-gradient(#d7e2ea 0 100%)'
  const paidPct = (paid / total) * 100
  const remainingPct = (remaining / total) * 100
  const pendingPct = (pending / total) * 100
  const a = paidPct
  const b = a + remainingPct
  return `conic-gradient(#0f6f74 0 ${a}%, #8ab8bc ${a}% ${b}%, #e95063 ${b}% ${b + pendingPct}%)`
}

function profitChartFromStatuses(statuses: DashboardStatusCount[]): {
  path: string
  area: string
  labels: string[]
} {
  const slice = statuses.slice(0, 7)
  const counts = slice.map((s) => s.count)
  if (counts.length === 0) {
    return {
      path: 'M24 96 L236 96',
      area: 'M24 126 L236 126 L236 104 L24 104 Z',
      labels: ['—', '—', '—', '—', '—', '—', '—'],
    }
  }
  const max = Math.max(...counts, 1)
  const xs = [24, 68, 110, 152, 198, 236].slice(0, counts.length)
  const points = counts.map((c, i) => {
    const x = xs[i] ?? 24 + i * 40
    const y = 126 - (c / max) * 48
    return { x, y }
  })
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`)
    .join(' ')
  const area = `${line} L${points[points.length - 1].x} 126 L${points[0].x} 126 Z`
  const labels = slice.map((s) => s.title.slice(0, 3))
  while (labels.length < 7) labels.push('—')
  return { path: line, area, labels }
}

type CompanyDashboardGridProps = {
  company: DashboardCompanySummary
}

export default function CompanyDashboardGrid({ company }: CompanyDashboardGridProps) {
  const owned = company.bookings_owned
  const paid = parseAmount(owned.paid_amount)
  const remaining = parseAmount(owned.remaining_amount)
  const total = parseAmount(owned.total_amount)
  const pendingPayout = parseAmount(company.payouts.pending_amount)
  const collectedPct = total > 0 ? Math.round((paid / total) * 100) : 0

  const statusCounts = owned.by_status.map((s) => s.count)
  const topStatuses = owned.by_status.slice(0, 3)
  const profitChart = profitChartFromStatuses(owned.by_status)

  const upcomingAll = [...owned.upcoming]
  const seen = new Set(owned.upcoming.map((b) => b.id))
  for (const row of company.bookings_as_supplier.upcoming) {
    if (!seen.has(row.id)) upcomingAll.push(row)
  }
  upcomingAll.sort((a, b) => {
    const ta = a.date_of_event ? new Date(a.date_of_event).getTime() : 0
    const tb = b.date_of_event ? new Date(b.date_of_event).getTime() : 0
    return ta - tb
  })

  const taskCards = [
    {
      day: 'Bk',
      date: String(owned.count),
      count: owned.count,
      provided: 'Quotations owned',
      working: formatMoney(owned.total_amount),
      tone: TONES[0],
      path: countsToSparklinePath(statusCounts.length ? statusCounts : [owned.count]),
    },
    {
      day: 'Pd',
      date: `${collectedPct}%`,
      count: collectedPct,
      provided: 'Collected',
      working: formatMoney(owned.paid_amount),
      tone: TONES[1],
      path: countsToSparklinePath([paid, total - paid].filter((n) => n >= 0)),
    },
    {
      day: 'Due',
      date: String(owned.outstanding_booking_count),
      count: owned.outstanding_booking_count,
      provided: 'Outstanding',
      working: formatMoney(owned.remaining_amount),
      tone: TONES[2],
      path: countsToSparklinePath(
        [owned.outstanding_booking_count, company.payouts.pending_count].filter(
          (n) => n > 0,
        ),
      ),
    },
  ]

  const earningRows: [string, string][] = [
    ['Collected', `${collectedPct}%`],
    ['Outstanding', total > 0 ? `${Math.round((remaining / total) * 100)}%` : '0%'],
    [
      'Pending payout',
      pendingPayout > 0 ? formatMoney(company.payouts.pending_amount) : '—',
    ],
  ]

  const alerts: string[] = []
  if (owned.downpayment_due_count > 0) {
    alerts.push(`${owned.downpayment_due_count} quotation(s) below downpayment`)
  }
  if (company.failed_payment_count > 0) {
    alerts.push(`${company.failed_payment_count} failed payment(s)`)
  }
  if (!company.kyb_verified) {
    alerts.push('KYB verification pending')
  }
  if (company.payouts.pending_count > 0) {
    alerts.push(`${company.payouts.pending_count} payout(s) awaiting transfer`)
  }

  return (
    <div className="dashboard-grid">
      <section className="dashboard-task-stack">
        {taskCards.map((task) => (
          <article
            key={task.day}
            className="dash-card dash-task-card"
          >
            <div className={`dash-date-badge dash-date-badge--${task.tone}`}>
              <span>{task.day}</span>
              <strong>{task.date}</strong>
            </div>
            <div className="dash-task-overview">
              <strong>{task.provided}</strong>
              <svg viewBox="0 0 100 42" aria-hidden="true">
                <path d={task.path} />
              </svg>
              <span className={`dash-task-count dash-task-count--${task.tone}`}>
                {task.count}
              </span>
            </div>
            <div className="dash-task-metric">
              <span>Report</span>
              <strong className={`dash-text-${task.tone}`}>{task.provided}</strong>
            </div>
            <div className="dash-task-metric">
              <span>Amount</span>
              <strong className={`dash-text-${task.tone}`}>{task.working}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="dash-card dash-team-card dash-company-card">
        <div className="dash-company-hero">
          <span className="dash-company-hero__icon" aria-hidden="true">
            <i className="bi bi-building" />
          </span>
          <div className="dash-company-hero__stats">
            <span>{company.calendar.events_this_week} events this week</span>
            <span>{company.bookings_as_supplier.count} as supplier</span>
          </div>
        </div>
        <div className="dash-team-footer">
          <span className="dash-company-avatar" aria-hidden="true">
            {company.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{company.name}</strong>
            <span>
              {company.is_main && 'Main · '}
              {company.kyb_verified ? 'KYB verified' : 'KYB pending'}
            </span>
          </div>
          <Link to="/quotations" className="dash-team-footer-link">
            Quotations
          </Link>
        </div>
      </section>

      <section className="dash-card dash-project-card">
        <header className="dash-card-head">
          <h5>Quotation pipeline</h5>
          <span className="dash-filter-btn">{owned.count} total</span>
        </header>
        {topStatuses.length > 0 ? (
          <div className="dash-status-grid">
            {topStatuses.map((status, index) => (
              <div
                key={status.status_id}
                className={`dash-status dash-status--${STATUS_VARIANTS[index] ?? 'running'}`}
                style={status.color ? { background: status.color } : undefined}
              >
                <i className="bi bi-layers" />
                <span>{status.count}</span>
                <small className="dash-status__label">{status.title}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="dash-report-empty">No quotations yet for this company.</p>
        )}
        <ul className="dash-project-list">
          {upcomingAll.slice(0, 6).map((row, index) => (
            <li key={row.id}>
              <i
                className={`bi bi-calendar-event ${PROJECT_ICONS[index % PROJECT_ICONS.length]}`}
              />
              <span title={row.title}>
                {row.unique_id} · {row.title}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="dash-card dash-earnings-card">
        <header className="dash-card-head">
          <h5>Collections</h5>
          <span className="dash-filter-btn">{formatMoney(owned.total_amount)} booked</span>
        </header>
        <div
          className="dash-donut"
          style={{ background: collectionDonutStyle(paid, remaining, pendingPayout) }}
          aria-hidden="true"
        >
          <span />
        </div>
        <ul className="dash-earning-list">
          {earningRows.map(([label, value], index) => (
            <li
              key={label}
              style={{
                ['--dash-earn-dot' as string]:
                  index === 0 ? '#0f6f74' : index === 1 ? '#8ab8bc' : '#e95063',
              }}
            >
              <span>{label}</span>
              <em />
              <strong>{value}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="dash-card dash-cta-card">
        <div className="dash-illustration" aria-hidden="true">
          <span className="dash-plant dash-plant--one" />
          <span className="dash-plant dash-plant--two" />
          <span className="dash-person" />
        </div>
        <h5>
          {company.payouts.pending_count > 0
            ? `${formatMoney(company.payouts.pending_amount)} ready for payout`
            : 'Track quotations, payments, and events in one place'}
        </h5>
        {company.is_user_company && company.payouts.pending_count > 0 ? (
          <Link to="/reports?tab=payouts" className="dash-cta-link">
            View payouts report
          </Link>
        ) : (
          <Link to="/quotations" className="dash-cta-link">
            Open quotations
          </Link>
        )}
        <div className="dash-carousel-dots" aria-hidden="true">
          <span className={company.kyb_verified ? 'is-active' : ''} />
          <span className={owned.count > 0 ? 'is-active' : ''} />
          <span className={company.calendar.upcoming_count > 0 ? 'is-active' : ''} />
        </div>
      </section>

      <section className="dash-card dash-meetings-card">
        <div className="dash-tab-header">
          <button type="button" className="is-active">
            Upcoming ({upcomingAll.length})
          </button>
          <button type="button" disabled>
            Calendar ({company.calendar.upcoming_count})
          </button>
        </div>
        <ul className="dash-meeting-list">
          {upcomingAll.length === 0 ? (
            <li className="dash-meeting-list__empty">No upcoming events.</li>
          ) : (
            upcomingAll.slice(0, 5).map((row) => (
              <li key={row.id}>
                <input type="checkbox" readOnly aria-label={`${row.title} event`} />
                <div>
                  <strong>{row.unique_id || row.title}</strong>
                  <span>
                    {row.title} · {formatEventWeekday(row.date_of_event)}{' '}
                    {formatEventDate(row.date_of_event)}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
        <Link to="/calendar" className="dash-show-more dash-show-more--link">
          Open calendar
        </Link>
      </section>

      <section className="dash-profit-stack">
        <article className="dash-card dash-profit-card">
          <h5>Quotations by status</h5>
          <svg viewBox="0 0 260 150" aria-hidden="true">
            <path className="dash-profit-line" d={profitChart.path} />
            <path className="dash-profit-area" d={profitChart.area} />
            {[24, 68, 110, 152, 198, 236].map((x) => (
              <line key={x} x1={x} y1="80" x2={x} y2="126" />
            ))}
          </svg>
          <div className="dash-days">
            {profitChart.labels.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
        </article>
        <article className="dash-card dash-toast-card">
          {alerts.length === 0 ? (
            <>
              <strong>All clear</strong> No outstanding alerts for {company.name}.
            </>
          ) : (
            <>
              <strong>Attention</strong> {alerts.join(' · ')}
            </>
          )}
        </article>
      </section>
    </div>
  )
}
