import { useTemplateStudioStore } from '../../store/templateStudioStore'

const PagesStrip = () => {
  const pages = useTemplateStudioStore((s) => s.document.pages)
  const activePageId = useTemplateStudioStore((s) => s.activePageId)
  const setActivePageId = useTemplateStudioStore((s) => s.setActivePageId)
  const addPage = useTemplateStudioStore((s) => s.addPage)

  return (
    <div className="ts-pages-strip" aria-label="Pages">
      <div className="ts-pages-strip-scroll">
        {pages.map((page, index) => (
          <button
            key={page.id}
            type="button"
            className={`ts-page-thumb${page.id === activePageId ? ' is-active' : ''}`}
            onClick={() => setActivePageId(page.id)}
            title={page.name}
          >
            <span className="ts-page-thumb-preview" aria-hidden="true">
              {index + 1}
            </span>
            <span className="ts-page-thumb-label">{page.name}</span>
          </button>
        ))}
        <button
          type="button"
          className="ts-page-thumb ts-page-thumb--add"
          onClick={() => addPage(`Page ${pages.length + 1}`)}
          title="Add page"
        >
          <i className="bi bi-plus-lg" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default PagesStrip
