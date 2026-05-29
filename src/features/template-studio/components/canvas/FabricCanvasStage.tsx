import { useRef } from 'react'
import { useFabricCanvas } from '../../hooks/useFabricCanvas'
import { useEditorPageScale } from '../../hooks/useEditorPageScale'
import { useTemplateStudioStore } from '../../store/templateStudioStore'
import HtmlOverlayLayer from './HtmlOverlayLayer'
import PageViewport from './PageViewport'
import '../../styles/page-viewport.css'

const FabricCanvasStage = () => {
  const stageRef = useRef<HTMLDivElement>(null)
  const page = useTemplateStudioStore((s) => s.getActivePage())
  const previewMode = useTemplateStudioStore((s) => s.previewMode)
  const gridSize = useTemplateStudioStore((s) => s.document.settings.snapGrid)
  const zoom = useTemplateStudioStore((s) => s.zoom)
  const selectedIds = useTemplateStudioStore((s) => s.selectedIds)

  const { pageScale, ready: scaleReady } = useEditorPageScale(page.width, stageRef, previewMode)
  const displayScale = pageScale * zoom
  const isDesktop = previewMode === 'desktop'

  const { hostRef, showGrid: gridOn } = useFabricCanvas({
    width: page.width,
    height: page.height,
    displayScale,
    enabled: scaleReady,
  })

  return (
    <div
      ref={stageRef}
      className={`ts-canvas-stage${isDesktop ? '' : ' ts-canvas-stage--mobile'}`}
    >
      <PageViewport
        pageWidth={page.width}
        pageHeight={page.height}
        background={page.background}
        scale={displayScale}
        ready={scaleReady}
        layout={isDesktop ? 'fluid' : 'fixed'}
        className={`ts-canvas-page${gridOn && scaleReady ? ' ts-canvas-page--grid' : ''}`}
        style={
          gridOn && scaleReady
            ? { ['--ts-grid-size' as string]: `${gridSize * displayScale}px` }
            : undefined
        }
      >
        <HtmlOverlayLayer
          elements={page.elements}
          selectedIds={selectedIds}
          pageWidth={page.width}
          pageHeight={page.height}
          displayScale={displayScale}
          visible={scaleReady}
        />
        <div ref={hostRef} className="ts-fabric-host" aria-label="Invitation canvas" />
      </PageViewport>
    </div>
  )
}

export default FabricCanvasStage
