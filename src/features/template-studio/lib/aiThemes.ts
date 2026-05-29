import type { WeddingTemplateDocument } from '../types/schema'

export type AiThemePreset = {
  id: string
  name: string
  description: string
  fonts: string[]
  heroBg: string
  accent: string
  bodyText: string
}

export const AI_THEME_PRESETS: AiThemePreset[] = [
  {
    id: 'romantic-blush',
    name: 'Romantic Blush',
    description: 'Soft rose tones with warm serif headings.',
    fonts: ['Playfair Display', 'Cormorant Garamond'],
    heroBg: '#faf0ee',
    accent: '#6b3e3e',
    bodyText: '#5c4545',
  },
  {
    id: 'modern-minimal',
    name: 'Modern Minimal',
    description: 'High contrast black and white with sans-serif type.',
    fonts: ['Montserrat', 'Lato'],
    heroBg: '#ffffff',
    accent: '#111111',
    bodyText: '#333333',
  },
  {
    id: 'garden-estate',
    name: 'Garden Estate',
    description: 'Earthy greens for outdoor celebrations.',
    fonts: ['Playfair Display', 'Raleway'],
    heroBg: '#f4f7f0',
    accent: '#2d4a3e',
    bodyText: '#3d5248',
  },
  {
    id: 'navy-gold',
    name: 'Navy & Gold',
    description: 'Formal evening palette with gold accents.',
    fonts: ['Cormorant Garamond', 'Lato'],
    heroBg: '#0f1a2e',
    accent: '#c9a962',
    bodyText: '#e8e4dc',
  },
]

/** Apply a theme preset across all pages (AI-style batch restyle). */
export function applyAiTheme(
  doc: WeddingTemplateDocument,
  preset: AiThemePreset,
): WeddingTemplateDocument {
  const next = structuredClone(doc)
  next.globalFonts = [...new Set([...preset.fonts, ...next.globalFonts])]
  next.meta.tags = [...new Set([...next.meta.tags, 'ai-theme', preset.id])]
  next.meta.updatedAt = new Date().toISOString()

  for (const page of next.pages) {
    if (page.sectionType === 'hero' || page.background.type === 'solid') {
      page.background = { type: 'solid', color: preset.heroBg }
    }
    for (const el of page.elements) {
      if (el.type === 'text') {
        el.style.fontFamily = preset.fonts[0] ?? el.style.fontFamily
        el.style.fill =
          el.style.fontSize >= 28 ? preset.accent : preset.bodyText
      }
    }
  }
  return next
}
