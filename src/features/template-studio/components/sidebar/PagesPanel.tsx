import { useTemplateStudioStore } from '../../store/templateStudioStore'

const PagesPanel = () => {
  const pages = useTemplateStudioStore((s) => s.document.pages)
  const activePageId = useTemplateStudioStore((s) => s.activePageId)
  const setActivePageId = useTemplateStudioStore((s) => s.setActivePageId)
  const addPage = useTemplateStudioStore((s) => s.addPage)

  return (
    <div className="ts-pages border-bottom bg-light px-3 py-2">
      <div className="d-flex align-items-center gap-2 overflow-auto">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            className={`btn btn-sm ${page.id === activePageId ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setActivePageId(page.id)}
          >
            {page.name}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={() => addPage(`Page ${pages.length + 1}`)}
          title="Add section"
        >
          <i className="bi bi-plus-lg" />
        </button>
      </div>
    </div>
  )
}

export default PagesPanel
