const TASKS = [
  {
    day: 'Mon',
    date: '20',
    count: 80,
    provided: "6 Day's",
    working: '60M',
    tone: 'navy',
    path: 'M0 36 C18 22 34 34 52 18 C69 2 84 16 100 10',
  },
  {
    day: 'Fri',
    date: '22',
    count: 152,
    provided: "8 Day's",
    working: '40M',
    tone: 'green',
    path: 'M0 34 C18 30 25 18 42 22 C58 27 66 8 80 11 C91 13 95 25 100 20',
  },
  {
    day: 'Wed',
    date: '25',
    count: 200,
    provided: '3 Week',
    working: '80H',
    tone: 'red',
    path: 'M0 33 C16 34 26 20 40 25 C56 33 67 8 82 14 C92 18 96 29 100 23',
  },
]

const EARNINGS = [
  ['19-20 years', '68%'],
  ['20-21 years', '58%'],
  ['21-22 years', '78%'],
  ['22-23 years', '88%'],
]

const MEETINGS = [
  ['Mark Moen', 'Website Redesign Briefing'],
  ['Johan Moen', 'CRM Integration Planning'],
  ['Carlos Ramirez', 'Brand Audit Presentation'],
]

const DashboardPage = () => {
  return (
    <div className="app-content dashboard-page">
      <div className="container-fluid">
        <div className="dashboard-grid">
          <section className="dashboard-task-stack">
            {TASKS.map((task) => (
              <article key={`${task.day}-${task.date}`} className="dash-card dash-task-card">
                <div className={`dash-date-badge dash-date-badge--${task.tone}`}>
                  <span>{task.day}</span>
                  <strong>{task.date}</strong>
                </div>
                <div className="dash-task-overview">
                  <strong>Task Overview</strong>
                  <svg viewBox="0 0 100 42" aria-hidden="true">
                    <path d={task.path} />
                  </svg>
                  <span className={`dash-task-count dash-task-count--${task.tone}`}>
                    {task.count}
                  </span>
                </div>
                <div className="dash-task-metric">
                  <span>Provided Time</span>
                  <strong className={`dash-text-${task.tone}`}>{task.provided}</strong>
                </div>
                <div className="dash-task-metric">
                  <span>Working Time</span>
                  <strong className={`dash-text-${task.tone}`}>{task.working}</strong>
                </div>
              </article>
            ))}
          </section>

          <section className="dash-card dash-team-card">
            <div className="dash-team-bg">
              <span className="dash-float dash-float--one" />
              <span className="dash-float dash-float--two" />
              <span className="dash-float dash-float--three" />
              <span className="dash-team-avatar dash-team-avatar--lg">
                <img src="https://i.pravatar.cc/120?u=team-a" alt="" />
              </span>
              <span className="dash-team-avatar dash-team-avatar--left">
                <img src="https://i.pravatar.cc/120?u=team-b" alt="" />
              </span>
              <span className="dash-team-avatar dash-team-avatar--right">
                <img src="https://i.pravatar.cc/120?u=team-c" alt="" />
              </span>
            </div>
            <div className="dash-team-footer">
              <img src="https://i.pravatar.cc/80?u=bette-hagenes" alt="" />
              <div>
                <strong>Bette Hagenes</strong>
                <span>Web Developer</span>
              </div>
              <button type="button">Join</button>
            </div>
          </section>

          <section className="dash-card dash-project-card">
            <header className="dash-card-head">
              <h5>Project</h5>
              <button type="button" className="dash-filter-btn">
                Filter <i className="bi bi-chevron-down" aria-hidden="true" />
              </button>
            </header>
            <div className="dash-status-grid">
              <div className="dash-status dash-status--running">
                <i className="bi bi-clock" />
                <span>Running</span>
              </div>
              <div className="dash-status dash-status--completed">
                <i className="bi bi-check-circle" />
                <span>Completed</span>
              </div>
              <div className="dash-status dash-status--pending">
                <i className="bi bi-arrow-clockwise" />
                <span>Pending</span>
              </div>
            </div>
            <ul className="dash-project-list">
              <li>
                <i className="bi bi-filetype-html dash-project-icon dash-project-icon--orange" />
                <span>New Task Assigned</span>
              </li>
              <li>
                <i className="bi bi-cpu dash-project-icon dash-project-icon--blue" />
                <span>API Development Phase</span>
              </li>
              <li>
                <i className="bi bi-funnel dash-project-icon dash-project-icon--green" />
                <span>Database Migration</span>
              </li>
              <li>
                <i className="bi bi-palette dash-project-icon dash-project-icon--pink" />
                <span>UI/UX Design Update</span>
              </li>
              <li>
                <i className="bi bi-filetype-psd dash-project-icon dash-project-icon--navy" />
                <span>New Task Assigned</span>
              </li>
              <li>
                <i className="bi bi-arrow-repeat dash-project-icon dash-project-icon--cyan" />
                <span>New Task Assigned</span>
              </li>
            </ul>
          </section>

          <section className="dash-card dash-earnings-card">
            <header className="dash-card-head">
              <h5>Yearly Earning</h5>
              <button type="button" className="dash-filter-btn">
                Jan <i className="bi bi-chevron-down" aria-hidden="true" />
              </button>
            </header>
            <div className="dash-donut" aria-hidden="true">
              <span />
            </div>
            <ul className="dash-earning-list">
              {EARNINGS.map(([label, value]) => (
                <li key={label}>
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
            <h5>Improve workflow efficiency with expert tips &amp; tools!</h5>
            <button type="button">Start Now</button>
            <div className="dash-carousel-dots" aria-hidden="true">
              <span className="is-active" />
              <span />
              <span />
            </div>
          </section>

          <section className="dash-card dash-meetings-card">
            <div className="dash-tab-header">
              <button type="button" className="is-active">Meetings</button>
              <button type="button">Notes</button>
            </div>
            <ul className="dash-meeting-list">
              {MEETINGS.map(([name, topic]) => (
                <li key={`${name}-${topic}`}>
                  <input type="checkbox" aria-label={`Select ${topic}`} />
                  <div>
                    <strong>{name}</strong>
                    <span>{topic}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="dash-show-more">Show More</button>
          </section>

          <section className="dash-profit-stack">
            <article className="dash-card dash-profit-card">
              <h5>Profit Overview</h5>
              <svg viewBox="0 0 260 150" aria-hidden="true">
                <path className="dash-profit-line" d="M24 96 H68 C86 96 88 48 110 48 C132 48 126 96 152 96 C178 96 178 68 198 68 L198 28" />
                <path className="dash-profit-area" d="M24 104 H68 C86 104 88 56 110 56 C132 56 126 104 152 104 C178 104 178 76 198 76 L198 126 H24 Z" />
                {[24, 68, 110, 152, 198, 236].map((x) => (
                  <line key={x} x1={x} y1="80" x2={x} y2="126" />
                ))}
              </svg>
              <div className="dash-days">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
            </article>
            <article className="dash-card dash-toast-card">
              <button type="button" aria-label="Dismiss notification">
                <i className="bi bi-x-lg" />
              </button>
              <strong>🚀 Welcome!</strong> Keep track of your projects efficiently.
            </article>
          </section>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
