import { useState } from 'react'

// ---------------------------------------------------------------------------
// Static demo data – mirrors the reference screenshot.
// ---------------------------------------------------------------------------

type DriveSection =
  | 'my-cloud'
  | 'starred'
  | 'recycle-bin'
  | 'recent'
  | 'shared'
  | 'help'
  | 'settings'

type SidebarItem = {
  id: DriveSection
  label: string
  icon: string
  badge?: string
}

const PRIMARY_NAV: SidebarItem[] = [
  { id: 'my-cloud', label: 'My Cloud', icon: 'bi-folder', badge: '10+' },
  { id: 'starred', label: 'Starred', icon: 'bi-star' },
  { id: 'recycle-bin', label: 'Recycle Bin', icon: 'bi-trash', badge: '2+' },
  { id: 'recent', label: 'Recent', icon: 'bi-clock-history' },
]

const SECONDARY_NAV: SidebarItem[] = [
  { id: 'shared', label: 'Shared File', icon: 'bi-send' },
  { id: 'help', label: 'Help', icon: 'bi-question-circle' },
  { id: 'settings', label: 'Settings', icon: 'bi-sliders2' },
]

type QuickFileKind = 'zip' | 'pdf' | 'doc' | 'image'

type QuickFile = {
  id: string
  name: string
  kind: QuickFileKind
}

const QUICK_ACCESS: QuickFile[] = [
  { id: 'q1', name: '3d illustration pack', kind: 'zip' },
  { id: 'q2', name: 'Thinking type.pdf', kind: 'pdf' },
  { id: 'q3', name: 'Product.docx', kind: 'doc' },
  { id: 'q4', name: 'Images/file folder', kind: 'image' },
]

type FolderCard = {
  id: string
  name: string
  usedGB: number
  totalGB: number
}

const FOLDERS: FolderCard[] = [
  { id: 'f1', name: 'My Work', usedGB: 25.67, totalGB: 50 },
  { id: 'f2', name: 'Graduation', usedGB: 25.67, totalGB: 50 },
  { id: 'f3', name: 'Company', usedGB: 25.67, totalGB: 50 },
  { id: 'f4', name: 'Photos', usedGB: 25.67, totalGB: 50 },
]

type RecentRow = {
  id: string
  name: string
  kind: QuickFileKind
  totalItems: number
  size: string
  lastModified: string
}

const RECENT: RecentRow[] = [
  {
    id: 'r1',
    name: 'Monthly Report July',
    kind: 'doc',
    totalItems: 17,
    size: '120MB',
    lastModified: '21 May, 2024',
  },
  {
    id: 'r2',
    name: 'Thesis-Brain McKnight',
    kind: 'pdf',
    totalItems: 15,
    size: '25MB',
    lastModified: '10 July, 2024',
  },
  {
    id: 'r3',
    name: 'Brand Guidelines',
    kind: 'zip',
    totalItems: 32,
    size: '210MB',
    lastModified: '02 August, 2024',
  },
  {
    id: 'r4',
    name: 'Wedding Photos',
    kind: 'image',
    totalItems: 248,
    size: '1.4GB',
    lastModified: '14 September, 2024',
  },
]

type StorageBreakdown = {
  label: string
  fileCount: string
  size: string
  icon: string
  iconClass: string
}

const STORAGE_TYPES: StorageBreakdown[] = [
  {
    label: 'Images',
    fileCount: '1,195 Files',
    size: '37.2GB',
    icon: 'bi-image',
    iconClass: 'fm-storage-icon--green',
  },
  {
    label: 'Videos',
    fileCount: '462 Files',
    size: '19.1GB',
    icon: 'bi-camera-reels',
    iconClass: 'fm-storage-icon--orange',
  },
  {
    label: 'Documents',
    fileCount: '328 Files',
    size: '8.4GB',
    icon: 'bi-file-earmark-text',
    iconClass: 'fm-storage-icon--blue',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Visual style + icon for each file kind. Keeps the tile / row / table
 * presentation consistent across the page.
 */
const FILE_VISUAL: Record<QuickFileKind, { icon: string; tone: string }> = {
  zip: { icon: 'bi-file-earmark-zip-fill', tone: 'zip' },
  pdf: { icon: 'bi-file-earmark-pdf-fill', tone: 'pdf' },
  doc: { icon: 'bi-file-earmark-word-fill', tone: 'doc' },
  image: { icon: 'bi-file-earmark-image-fill', tone: 'image' },
}

// ---------------------------------------------------------------------------
// Gauge (Overview donut)
// ---------------------------------------------------------------------------

type GaugeProps = { percent: number }

const GAUGE_RADIUS = 40
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS
/** 3/4 circle gauge: the bottom 90° is left open. */
const GAUGE_TRACK_LENGTH = GAUGE_CIRCUMFERENCE * 0.75

const Gauge = ({ percent }: GaugeProps) => {
  const clamped = Math.max(0, Math.min(100, percent))
  const fillLength = GAUGE_TRACK_LENGTH * (clamped / 100)
  return (
    <svg
      viewBox="0 0 100 100"
      className="fm-gauge"
      role="img"
      aria-label={`Used ${clamped}% of storage`}
    >
      {/* Background track (3/4 arc, light gray) */}
      <circle
        cx="50"
        cy="50"
        r={GAUGE_RADIUS}
        fill="none"
        stroke="#e6e8eb"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${GAUGE_TRACK_LENGTH} ${GAUGE_CIRCUMFERENCE - GAUGE_TRACK_LENGTH}`}
        transform="rotate(135 50 50)"
      />
      {/* Foreground fill */}
      <circle
        cx="50"
        cy="50"
        r={GAUGE_RADIUS}
        fill="none"
        stroke="var(--brand-navy)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${fillLength} ${GAUGE_CIRCUMFERENCE - fillLength}`}
        transform="rotate(135 50 50)"
      />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="var(--brand-navy)"
      >
        {clamped}%
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const FileManagerPage = () => {
  const [activeNav, setActiveNav] = useState<DriveSection>('my-cloud')
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())

  const toggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const renderNavList = (items: SidebarItem[]) => (
    <ul className="fm-nav">
      {items.map((item) => {
        const isActive = activeNav === item.id
        return (
          <li key={item.id}>
            <button
              type="button"
              className={`fm-nav-link${isActive ? ' is-active' : ''}`}
              onClick={() => setActiveNav(item.id)}
            >
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              <span className="fm-nav-label">{item.label}</span>
              {item.badge && <span className="fm-nav-badge">{item.badge}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="fm-layout">
          {/* ============================================================
              Left column: drive nav + overview
              ============================================================ */}
          <aside className="fm-sidebar">
            <section className="fm-card fm-card--padded">
              <h6 className="fm-card-title">My Drive</h6>
              {renderNavList(PRIMARY_NAV)}
              <div className="fm-nav-divider" />
              {renderNavList(SECONDARY_NAV)}
            </section>

            <section className="fm-card fm-card--padded">
              <h6 className="fm-card-title">Overview</h6>
              <div className="fm-overview">
                <Gauge percent={70} />
              </div>
              <ul className="fm-storage">
                {STORAGE_TYPES.map((s) => (
                  <li key={s.label} className="fm-storage-row">
                    <span className={`fm-storage-icon ${s.iconClass}`}>
                      <i className={`bi ${s.icon}`} aria-hidden="true" />
                    </span>
                    <div className="fm-storage-text">
                      <span className="fm-storage-label">{s.label}</span>
                      <span className="fm-storage-count">{s.fileCount}</span>
                    </div>
                    <span className="fm-storage-size">{s.size}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>

          {/* ============================================================
              Right column: quick-access, folders, recent
              ============================================================ */}
          <section className="fm-main">
            {/* Quick-Access */}
            <section className="fm-card fm-section">
              <header className="fm-section-head">
                <h5 className="fm-section-title">Quick-Access</h5>
                <button type="button" className="fm-action-btn">
                  Add Files
                </button>
              </header>
              <div className="fm-grid fm-grid--tiles">
                {QUICK_ACCESS.map((file) => {
                  const visual = FILE_VISUAL[file.kind]
                  const starred = starredIds.has(file.id)
                  return (
                    <article key={file.id} className="fm-tile">
                      <header className="fm-tile-head">
                        <button
                          type="button"
                          className={`fm-star${starred ? ' is-on' : ''}`}
                          onClick={() => toggleStar(file.id)}
                          aria-label={starred ? 'Unstar' : 'Star'}
                          aria-pressed={starred}
                        >
                          <i
                            className={`bi ${starred ? 'bi-star-fill' : 'bi-star'}`}
                          />
                        </button>
                        <button
                          type="button"
                          className="fm-tile-menu"
                          aria-label="More actions"
                        >
                          <i className="bi bi-three-dots-vertical" />
                        </button>
                      </header>
                      <div className={`fm-tile-icon fm-tile-icon--${visual.tone}`}>
                        <i className={`bi ${visual.icon}`} aria-hidden="true" />
                      </div>
                      <div className="fm-tile-name">{file.name}</div>
                    </article>
                  )
                })}
              </div>
            </section>

            {/* Folders */}
            <section className="fm-card fm-section">
              <header className="fm-section-head">
                <h5 className="fm-section-title">Folders</h5>
                <button type="button" className="fm-action-btn">
                  Add Folder
                </button>
              </header>
              <div className="fm-grid fm-grid--tiles">
                {FOLDERS.map((folder) => {
                  const starred = starredIds.has(folder.id)
                  const pct = Math.min(
                    100,
                    Math.round((folder.usedGB / folder.totalGB) * 100),
                  )
                  return (
                    <article key={folder.id} className="fm-tile">
                      <header className="fm-tile-head">
                        <button
                          type="button"
                          className={`fm-star${starred ? ' is-on' : ''}`}
                          onClick={() => toggleStar(folder.id)}
                          aria-label={starred ? 'Unstar' : 'Star'}
                          aria-pressed={starred}
                        >
                          <i
                            className={`bi ${starred ? 'bi-star-fill' : 'bi-star'}`}
                          />
                        </button>
                        <button
                          type="button"
                          className="fm-tile-menu"
                          aria-label="More actions"
                        >
                          <i className="bi bi-three-dots-vertical" />
                        </button>
                      </header>
                      <div className="fm-tile-icon fm-tile-icon--folder">
                        <i className="bi bi-folder-fill" aria-hidden="true" />
                      </div>
                      <div className="fm-tile-name">{folder.name}</div>
                      <div className="fm-folder-meta">
                        <span className="fm-folder-used">
                          {folder.usedGB.toFixed(2)}GB
                        </span>
                        <span className="fm-folder-total">{folder.totalGB}GB</span>
                      </div>
                      <div
                        className="fm-folder-bar"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className="fm-folder-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            {/* Recent Added */}
            <section className="fm-card fm-section">
              <header className="fm-section-head">
                <h5 className="fm-section-title">Recent Added</h5>
              </header>
              <div className="fm-recent-scroll">
                <table className="fm-recent-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Total Items</th>
                      <th>Size</th>
                      <th>Last Modified</th>
                      <th className="fm-recent-actions-th">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT.map((row) => {
                      const visual = FILE_VISUAL[row.kind]
                      return (
                        <tr key={row.id}>
                          <td>
                            <div className="fm-recent-name">
                              <span className={`fm-recent-icon fm-recent-icon--${visual.tone}`}>
                                <i className={`bi ${visual.icon}`} aria-hidden="true" />
                              </span>
                              <span>{row.name}</span>
                            </div>
                          </td>
                          <td className="fm-recent-items">{row.totalItems}</td>
                          <td className="fm-recent-size">{row.size}</td>
                          <td className="fm-recent-date">{row.lastModified}</td>
                          <td className="fm-recent-actions">
                            <button
                              type="button"
                              className="fm-tile-menu"
                              aria-label="More actions"
                            >
                              <i className="bi bi-three-dots-vertical" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  )
}

export default FileManagerPage
