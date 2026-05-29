import { useState } from 'react'
import type { LeftToolId } from './components/sidebar/leftTools'
import LeftToolRail from './components/sidebar/LeftToolRail'
import LeftPanel from './components/sidebar/LeftPanel'
import RightSidebar from './components/sidebar/RightSidebar'
import PagesStrip from './components/sidebar/PagesStrip'
import FabricCanvasStage from './components/canvas/FabricCanvasStage'
import EditorTopBar from './components/toolbar/EditorTopBar'
import MarketplaceModal from './components/modals/MarketplaceModal'
import TemplatesListModal from './components/modals/TemplatesListModal'
import RsvpFormEditorModal from './components/modals/RsvpFormEditorModal'
import { useAutoSave } from './hooks/useAutoSave'
import { useGoogleFonts } from './hooks/useGoogleFonts'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useTemplateStudioStore } from './store/templateStudioStore'
import type { RsvpElement } from './types/schema'
import './styles/template-studio.css'

type TemplateStudioEditorProps = {
  onTemplateSaved?: (id: number, title: string) => void
}

const TemplateStudioEditor = ({ onTemplateSaved }: TemplateStudioEditorProps) => {
  const [leftTool, setLeftTool] = useState<LeftToolId>('elements')
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const page = useTemplateStudioStore((s) => s.getActivePage())
  const rsvpFormEditorId = useTemplateStudioStore((s) => s.rsvpFormEditorId)
  const updateElement = useTemplateStudioStore((s) => s.updateElement)
  const closeRsvpFormEditor = useTemplateStudioStore((s) => s.closeRsvpFormEditor)

  const rsvpEditorElement = (() => {
    if (!rsvpFormEditorId) return null
    const el = page.elements.find((e) => e.id === rsvpFormEditorId && e.type === 'rsvp')
    return el ? (el as RsvpElement) : null
  })()

  useAutoSave()
  useKeyboardShortcuts()
  useGoogleFonts()

  return (
    <div className="ts-canva">
      <EditorTopBar
        onOpenTemplates={() => setTemplatesOpen(true)}
        onTemplateSaved={onTemplateSaved}
      />
      <div className="ts-canva-body">
        <LeftToolRail active={leftTool} onSelect={setLeftTool} />
        {leftTool && <LeftPanel tool={leftTool} />}
        <div className="ts-canva-workspace">
          <FabricCanvasStage />
          <PagesStrip />
        </div>
        <RightSidebar />
      </div>
      <MarketplaceModal />
      <TemplatesListModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <RsvpFormEditorModal
        open={Boolean(rsvpEditorElement)}
        element={rsvpEditorElement}
        onClose={closeRsvpFormEditor}
        onSave={(patch) => {
          if (!rsvpFormEditorId) return
          updateElement(rsvpFormEditorId, patch, { preserveCanvas: true })
        }}
      />
    </div>
  )
}

export default TemplateStudioEditor
