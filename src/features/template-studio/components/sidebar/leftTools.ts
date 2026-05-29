export type LeftToolId = 'elements' | 'text' | 'widgets' | 'themes' | 'pages' | null

export const LEFT_TOOLS: {
  id: Exclude<LeftToolId, null>
  label: string
  icon: string
}[] = [
  { id: 'elements', label: 'Elements', icon: 'bi-grid-3x3-gap' },
  { id: 'text', label: 'Text', icon: 'bi-fonts' },
  { id: 'widgets', label: 'Widgets', icon: 'bi-box-seam' },
  { id: 'themes', label: 'Design', icon: 'bi-palette' },
  { id: 'pages', label: 'Pages', icon: 'bi-layers' },
]
