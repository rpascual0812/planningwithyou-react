import PropertiesPanel from './PropertiesPanel'
import AnimationTimelinePanel from './AnimationTimelinePanel'
import { useTemplateStudioStore } from '../../store/templateStudioStore'
import type { RightPanelTab } from '../../store/templateStudioStore'

const TABS: { id: RightPanelTab; label: string; icon: string }[] = [
  { id: 'properties', label: 'Edit', icon: 'bi-sliders' },
  { id: 'animation', label: 'Animate', icon: 'bi-film' },
]

const RightSidebar = () => {
  const tab = useTemplateStudioStore((s) => s.rightPanelTab)
  const setTab = useTemplateStudioStore((s) => s.setRightPanelTab)

  return (
    <aside className="ts-right-panel" aria-label="Properties">
      <div className="ts-right-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ts-right-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`bi ${t.icon}`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>
      <div className="ts-right-body">
        {tab === 'properties' && <PropertiesPanel embedded />}
        {tab === 'animation' && <AnimationTimelinePanel />}
      </div>
    </aside>
  )
}

export default RightSidebar
