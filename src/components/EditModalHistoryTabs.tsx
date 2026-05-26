type Tab = 'details' | 'history'

type Props = {
  tab: Tab
  onTab: (tab: Tab) => void
  showHistory: boolean
}

const EditModalHistoryTabs = ({ tab, onTab, showHistory }: Props) => {
  if (!showHistory) return null
  return (
    <ul className="nav nav-tabs mb-3" role="tablist">
      <li className="nav-item" role="presentation">
        <button
          type="button"
          className={`nav-link${tab === 'details' ? ' active' : ''}`}
          role="tab"
          aria-selected={tab === 'details'}
          onClick={() => onTab('details')}
        >
          Details
        </button>
      </li>
      <li className="nav-item" role="presentation">
        <button
          type="button"
          className={`nav-link${tab === 'history' ? ' active' : ''}`}
          role="tab"
          aria-selected={tab === 'history'}
          onClick={() => onTab('history')}
        >
          History
        </button>
      </li>
    </ul>
  )
}

export default EditModalHistoryTabs
