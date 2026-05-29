import type { CountdownElement, CountdownStyle } from '../types/schema'

export const DEFAULT_COUNTDOWN_STYLE: CountdownStyle = 'split'

export const COUNTDOWN_STYLE_OPTIONS: { value: CountdownStyle; label: string }[] = [
  { value: 'split', label: 'Split boxes' },
  { value: 'cards', label: 'Card grid' },
  { value: 'classic', label: 'Classic inline' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'dark', label: 'Dark banner' },
  { value: 'elegant', label: 'Elegant serif' },
]

export function normalizeCountdownStyle(style?: CountdownStyle): CountdownStyle {
  if (style && COUNTDOWN_STYLE_OPTIONS.some((o) => o.value === style)) {
    return style
  }
  return DEFAULT_COUNTDOWN_STYLE
}

export function normalizeCountdownElement(el: CountdownElement): CountdownElement {
  return {
    ...el,
    style: normalizeCountdownStyle(el.style),
  }
}
