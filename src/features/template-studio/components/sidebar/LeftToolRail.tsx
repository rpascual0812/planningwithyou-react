import type { LeftToolId } from './leftTools'
import { LEFT_TOOLS } from './leftTools'

type LeftToolRailProps = {
  active: LeftToolId
  onSelect: (tool: LeftToolId) => void
}

const LeftToolRail = ({ active, onSelect }: LeftToolRailProps) => (
  <nav className="ts-rail" aria-label="Editor tools">
    {LEFT_TOOLS.map((tool) => {
      const isActive = active === tool.id
      return (
        <button
          key={tool.id}
          type="button"
          className={`ts-rail-btn${isActive ? ' is-active' : ''}`}
          onClick={() => onSelect(isActive ? null : tool.id)}
          title={tool.label}
        >
          <i className={`bi ${tool.icon}`} aria-hidden="true" />
          <span className="ts-rail-label">{tool.label}</span>
        </button>
      )
    })}
  </nav>
)

export default LeftToolRail
