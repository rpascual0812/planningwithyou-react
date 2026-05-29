import { AI_THEME_PRESETS, applyAiTheme } from '../../lib/aiThemes'
import { useTemplateStudioStore } from '../../store/templateStudioStore'

const AiThemesPanel = () => {
  const document = useTemplateStudioStore((s) => s.document)
  const setDocument = useTemplateStudioStore((s) => s.setDocument)

  return (
    <div className="ts-ai-themes">
      <p className="ts-ai-themes-intro">
        Apply theme presets to colors and fonts across all pages instantly.
      </p>
      <div className="ts-theme-list">
        {AI_THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="ts-theme-card"
            onClick={() => setDocument(applyAiTheme(document, preset))}
          >
            <span
              className="ts-theme-swatch"
              style={{
                background: preset.heroBg,
                borderColor: preset.accent,
              }}
              aria-hidden="true"
            />
            <span className="ts-theme-info">
              <span className="ts-theme-name">{preset.name}</span>
              <span className="ts-theme-desc">{preset.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default AiThemesPanel
