import { useEffect } from 'react'
import { useTemplateStudioStore } from '../store/templateStudioStore'

export function useKeyboardShortcuts() {
  const undo = useTemplateStudioStore((s) => s.undo)
  const redo = useTemplateStudioStore((s) => s.redo)
  const deleteSelected = useTemplateStudioStore((s) => s.deleteSelected)
  const duplicateSelected = useTemplateStudioStore((s) => s.duplicateSelected)
  const layerSelected = useTemplateStudioStore((s) => s.layerSelected)
  const selectedIds = useTemplateStudioStore((s) => s.selectedIds)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const editingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable

      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (meta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !editingText) {
        e.preventDefault()
        deleteSelected()
      } else if (meta && e.key === 'd') {
        e.preventDefault()
        duplicateSelected()
      } else if (selectedIds.length > 0 && !editingText && meta && e.key === ']') {
        e.preventDefault()
        layerSelected(e.shiftKey ? 'front' : 'forward')
      } else if (selectedIds.length > 0 && !editingText && meta && e.key === '[') {
        e.preventDefault()
        layerSelected(e.shiftKey ? 'back' : 'backward')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, deleteSelected, duplicateSelected, layerSelected, selectedIds])
}
