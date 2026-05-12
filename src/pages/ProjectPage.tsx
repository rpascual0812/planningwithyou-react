import { Navigate, useParams } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Demo data – matches the reference screenshot.
// ---------------------------------------------------------------------------

type TeamMember = {
  id: string
  name: string
  role: string
  /** Real photo URL; falls back to initials chip if missing. */
  photo?: string
  /** Background color for the initials fallback. */
  tone: string
}

const TEAM: TeamMember[] = [
  {
    id: 't1',
    name: 'Bette Hagenes',
    role: 'Web Developer',
    photo: 'https://i.pravatar.cc/96?u=bette-hagenes-1',
    tone: '#9c6cd0',
  },
  {
    id: 't2',
    name: 'Fleta Walsh',
    role: 'Web Designer',
    photo: 'https://i.pravatar.cc/96?u=fleta-walsh-1',
    tone: '#f0a830',
  },
  {
    id: 't3',
    name: 'Lenora',
    role: 'UI/UX Designer',
    tone: '#5a8edb',
  },
  {
    id: 't4',
    name: 'Fleta Walsh',
    role: 'React Developer',
    photo: 'https://i.pravatar.cc/96?u=fleta-walsh-2',
    tone: '#52b585',
  },
  {
    id: 't5',
    name: 'Emery McKenzie',
    role: 'Web Developer',
    tone: '#1f3a5f',
  },
  {
    id: 't6',
    name: 'Bette Hagenes',
    role: 'Web Designer',
    photo: 'https://i.pravatar.cc/96?u=bette-hagenes-2',
    tone: '#d65a5a',
  },
]

const ASSIGNED_BY: { id: string; label: string; tone: string }[] = [
  { id: 'a1', label: 'A', tone: '#d65a5a' },
  { id: 'a2', label: 'CD', tone: '#52b585' },
  { id: 'a3', label: 'XYZ', tone: '#f0c94d' },
  { id: 'a4', label: '2+', tone: '#e6e8eb' },
]

type ActivityKind =
  | 'reaction'
  | 'image-upload'
  | 'post'
  | 'request'
  | 'attachments'

type ActivityEntry = {
  id: string
  actor: { name: string; tone: string }
  kind: ActivityKind
  tag?: string
  timestamp: string
  // Variant-specific data
  reactionLabel?: string
  postTitle?: string
  postExcerpt?: string
  postStats?: { reactions: number; replies: number }
  images?: string[]
  showActions?: boolean
}

const ACTIVITY: ActivityEntry[] = [
  {
    id: 'a1',
    actor: { name: 'Wilson', tone: '#5a8edb' },
    kind: 'reaction',
    reactionLabel: 'added reaction in',
    tag: '#product website',
    timestamp: '09.00AM',
  },
  {
    id: 'a2',
    actor: { name: 'Image Upload', tone: '#9c6cd0' },
    kind: 'image-upload',
    timestamp: '12:45 PM',
    images: [
      'https://picsum.photos/seed/proj-1/240/180',
      'https://picsum.photos/seed/proj-2/240/180',
      'https://picsum.photos/seed/proj-3/240/180',
    ],
  },
  {
    id: 'a3',
    actor: { name: 'Dane Wiza', tone: '#52b585' },
    kind: 'post',
    reactionLabel: 'added reaction in',
    tag: '#product website',
    timestamp: '09.00AM',
    postTitle: 'Need a feature',
    postExcerpt: 'Hello everyone, question on email marketing...',
    postStats: { reactions: 10, replies: 12 },
  },
  {
    id: 'a4',
    actor: { name: 'Betty Mante', tone: '#d65a5a' },
    kind: 'request',
    reactionLabel: 'Request joined',
    tag: '#reaserchteam',
    timestamp: '4 days ago',
    showActions: true,
  },
  {
    id: 'a5',
    actor: { name: 'Pinkie', tone: '#1f3a5f' },
    kind: 'attachments',
    reactionLabel: 'uploaded 2 attachments',
    tag: '#reaserchteam',
    timestamp: '4 days ago',
    showActions: true,
  },
]

type FolderRow = {
  id: string
  name: string
  files: number
  size: string
}

const FOLDERS: FolderRow[] = [
  { id: 'd1', name: 'Admin Work', files: 18, size: '32GB' },
  { id: 'd2', name: 'Design Drafts', files: 42, size: '54GB' },
  { id: 'd3', name: 'Photos', files: 312, size: '128GB' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function firstWordInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>()

  // Restrict the route to alphanumeric segments – anything else (e.g. slugs
  // with dashes) gets sent back to the dashboard so we don't shadow it.
  if (!projectId || !/^[a-zA-Z0-9]+$/.test(projectId)) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="project-page">
      <div className="project-page-grid">
        {/* ============================================================
            Left column: project details + team
            ============================================================ */}
        <aside className="project-col project-col--left">
          <section className="project-card">
            <h6 className="project-card-title">Project Details</h6>
            <dl className="project-details">
              <div>
                <dt>Name</dt>
                <dd>ki-admin</dd>
              </div>
              <div>
                <dt>Manager</dt>
                <dd>Leonor Hill</dd>
              </div>
              <div>
                <dt>Start Date</dt>
                <dd className="project-details-date project-details-date--start">
                  10 Apr 2024
                </dd>
              </div>
              <div>
                <dt>End Date</dt>
                <dd className="project-details-date project-details-date--end">
                  20 Jul 2024
                </dd>
              </div>
              <div>
                <dt>Pricing</dt>
                <dd className="project-details-price">$200k</dd>
              </div>
              <div>
                <dt>Assigned By</dt>
                <dd>
                  <div className="project-avatars">
                    {ASSIGNED_BY.map((a) => (
                      <span
                        key={a.id}
                        className="project-avatar-chip"
                        style={{ background: a.tone }}
                        aria-hidden="true"
                      >
                        {a.label}
                      </span>
                    ))}
                  </div>
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className="project-status">In progress</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="project-card">
            <h6 className="project-card-title">Project Team</h6>
            <ul className="project-team-list">
              {TEAM.map((member) => (
                <li key={member.id} className="project-team-row">
                  <span
                    className="project-team-avatar"
                    style={{ background: member.tone }}
                    aria-hidden="true"
                  >
                    {member.photo ? (
                      <img
                        src={member.photo}
                        alt=""
                        width={36}
                        height={36}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>{initials(member.name)}</span>
                    )}
                  </span>
                  <div className="project-team-meta">
                    <span className="project-team-name">{member.name}</span>
                    <span className="project-team-role">{member.role}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        {/* ============================================================
            Center column: activity feed
            ============================================================ */}
        <section className="project-col project-col--center">
          <div className="project-card project-card--activity">
            <h6 className="project-card-title">Project Activity</h6>
            <ol className="project-activity">
              {ACTIVITY.map((entry) => (
                <li key={entry.id} className="project-activity-item">
                  <span
                    className="project-activity-avatar"
                    style={{ background: entry.actor.tone }}
                    aria-hidden="true"
                  >
                    {firstWordInitial(entry.actor.name)}
                  </span>
                  <div className="project-activity-body">
                    <div className="project-activity-meta">
                      <span
                        className="project-activity-actor"
                        style={{ color: entry.actor.tone }}
                      >
                        {entry.actor.name}
                      </span>
                      {entry.reactionLabel && (
                        <span className="project-activity-action">
                          {' '}
                          {entry.reactionLabel}
                          {entry.tag ? ' ' : ''}
                        </span>
                      )}
                      {entry.tag && (
                        <span className="project-activity-tag">{entry.tag}</span>
                      )}
                    </div>
                    <div className="project-activity-time">{entry.timestamp}</div>

                    {entry.kind === 'image-upload' && entry.images && (
                      <div className="project-activity-card project-activity-images">
                        {entry.images.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt=""
                            referrerPolicy="no-referrer"
                          />
                        ))}
                      </div>
                    )}

                    {entry.kind === 'post' && entry.postTitle && (
                      <div className="project-activity-card project-activity-post">
                        <div className="project-activity-post-title">
                          {entry.postTitle}
                        </div>
                        <p className="project-activity-post-text">
                          {entry.postExcerpt}
                        </p>
                        {entry.postStats && (
                          <div className="project-activity-post-stats">
                            <span className="project-pill project-pill--green">
                              {entry.postStats.reactions} Reactions
                            </span>
                            <span className="project-pill project-pill--green">
                              {entry.postStats.replies} Replies
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {entry.showActions && (
                      <div className="project-activity-actions">
                        <button
                          type="button"
                          className="project-btn project-btn--accept"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="project-btn project-btn--reject"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============================================================
            Right column: about + data folders
            ============================================================ */}
        <aside className="project-col project-col--right">
          <section className="project-card">
            <h6 className="project-card-title">About Project</h6>

            <h6 className="project-about-heading">Project Description</h6>
            <p className="project-about-text">
              An admin panel or a control panel is a system that enables
              administrators and other website workers to conduct various tasks
              like monitoring, maintaining, and controlling certain business
              processes. An admin dashboard is one of the core components of a
              control panel.
            </p>

            <h6 className="project-about-heading">Task Information</h6>
            <p className="project-about-text">
              The success of a project relies heavily on effective project
              management, which involves the careful planning, organizing, and
              controlling of resources to ensure that the project objectives are
              met. This includes defining the project scope, setting realistic
              timelines and budgets.
            </p>

            <h6 className="project-about-heading">Background Information</h6>
            <p className="project-about-text">
              A project is a planned endeavor that aims to achieve a specific
              goal within a defined timeframe. It involves a series of tasks and
              activities that are coordinated and executed by a team of
              individuals. Projects can vary in size, complexity, and scope,
              ranging from small-scale initiatives to large-scale undertakings
              that span across multiple departments or organizations.
            </p>
          </section>

          <section className="project-card">
            <h6 className="project-card-title">Data Folder &amp; Files</h6>
            <ul className="project-folders">
              {FOLDERS.map((f) => (
                <li key={f.id} className="project-folder-row">
                  <span className="project-folder-icon" aria-hidden="true">
                    <i className="bi bi-folder-fill" />
                  </span>
                  <div className="project-folder-meta">
                    <span className="project-folder-name">{f.name}</span>
                    <span className="project-folder-count">
                      {f.files} Files
                    </span>
                  </div>
                  <span className="project-folder-size">{f.size}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="project-page-id" aria-label="Project reference">
            Project ref: <code>{projectId}</code>
          </p>
        </aside>
      </div>
    </div>
  )
}

export default ProjectPage
