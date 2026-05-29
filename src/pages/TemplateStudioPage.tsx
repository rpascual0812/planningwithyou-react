import TemplateStudioEditor from '../features/template-studio/TemplateStudioEditor'
import { useTemplateStudioRoute } from '../features/template-studio/hooks/useTemplateStudioRoute'

const TemplateStudioPage = () => {
  const { loading, loadError, setTemplateUrl } = useTemplateStudioRoute()

  return (
    <div className="app-content p-0">
      {loading && (
        <div className="ts-route-status text-muted small px-3 py-2">Loading template…</div>
      )}
      {loadError && (
        <div className="alert alert-warning mx-3 mt-2 mb-0 py-2 small" role="alert">
          {loadError}
        </div>
      )}
      <TemplateStudioEditor onTemplateSaved={setTemplateUrl} />
    </div>
  )
}

export default TemplateStudioPage
