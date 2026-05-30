import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export type ProfileTab = 'profile' | 'password' | 'support'

const TAB_PARAM = 'tab'

export const PROFILE_NAV_ITEMS: {
  id: ProfileTab
  label: string
  icon: string
}[] = [
  { id: 'profile', label: 'Profile', icon: 'bi-person' },
  { id: 'password', label: 'Reset Password', icon: 'bi-shield-lock' },
  { id: 'support', label: 'Support', icon: 'bi-life-preserver' },
]

export function resolveProfileTab(search: string): ProfileTab {
  const tab = new URLSearchParams(search).get(TAB_PARAM)
  if (tab === 'password') return 'password'
  if (tab === 'support') return 'support'
  return 'profile'
}

type ProfileSettingsNavProps = {
  activeTab: ProfileTab
  onTabChange: (tab: ProfileTab) => void
}

const ProfileSettingsNav = ({ activeTab, onTabChange }: ProfileSettingsNavProps) => {
  return (
    <aside className="settings-nav-card">
      <h5 className="settings-card-title">Edit Profile</h5>
      <ul className="settings-nav">
        {PROFILE_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`settings-nav-link${isActive ? ' is-active' : ''}`}
                data-tour={`profile-nav-${item.id}`}
                onClick={() => onTabChange(item.id)}
              >
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

export function useProfileTabNavigation() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = resolveProfileTab(`?${searchParams.toString()}`)

  const setActiveTab = useCallback(
    (tab: ProfileTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (tab === 'profile') next.delete(TAB_PARAM)
          else next.set(TAB_PARAM, tab)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const activeLabel =
    activeTab === 'support'
      ? 'Support'
      : PROFILE_NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? 'Profile'

  return { activeTab, setActiveTab, activeLabel }
}

export default ProfileSettingsNav
