import { useRef } from 'react'
import PageViewport from '../components/canvas/PageViewport'
import { usePageScale } from '../hooks/usePageScale'
import { visiblePageElements } from '../lib/pageBounds'
import type { TemplatePage, WeddingTemplateDocument } from '../types/schema'
import RenderedElement from './RenderedElement'
import '../styles/page-viewport.css'

type InvitationRendererProps = {
  document: WeddingTemplateDocument
}

const InvitationRenderer = ({ document }: InvitationRendererProps) => (
  <article className="invitation-renderer">
    {document.pages.map((page) => (
      <InvitationPageSection key={page.id} page={page} />
    ))}
  </article>
)

function InvitationPageSection({ page }: { page: TemplatePage }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const sorted = visiblePageElements(page)
  const { scale, ready } = usePageScale(page.width, viewportRef)

  return (
    <section
      className="invitation-page"
      data-section={page.sectionType}
      aria-label={page.name}
      ref={viewportRef}
    >
      <PageViewport
        pageWidth={page.width}
        pageHeight={page.height}
        background={page.background}
        scale={scale}
        ready={ready}
        layout="fluid"
      >
        {sorted.map((el) => (
          <RenderedElement key={el.id} element={el} pageScale={scale} />
        ))}
      </PageViewport>
    </section>
  )
}

export default InvitationRenderer
