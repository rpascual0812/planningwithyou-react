/** Scalable JSON document for wedding invitation website templates (SaaS-ready). */

export type ElementType =
  | 'text'
  | 'image'
  | 'video'
  | 'map'
  | 'shape'
  | 'countdown'
  | 'music'
  | 'rsvp'
  | 'gallery'

export type SectionType =
  | 'hero'
  | 'story'
  | 'schedule'
  | 'rsvp'
  | 'gallery'
  | 'venue'
  | 'countdown'
  | 'custom'

export type TextAlign = 'left' | 'center' | 'right' | 'justify'

export type BackgroundType = 'solid' | 'gradient' | 'image' | 'video'

export type GradientStop = { color: string; offset: number }

export type PageBackground = {
  type: BackgroundType
  color?: string
  gradient?: { angle: number; stops: GradientStop[] }
  imageUrl?: string
  videoUrl?: string
  overlayColor?: string
  overlayOpacity?: number
  blur?: number
}

export type ElementTransform = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scaleX: number
  scaleY: number
  opacity: number
  zIndex: number
  locked?: boolean
}

export type TextStyle = {
  fontFamily: string
  fontSize: number
  fill: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  underline: boolean
  charSpacing: number
  textAlign: TextAlign
  lineHeight: number
}

export type ImageStyle = {
  borderRadius: number
  shadowBlur: number
  shadowColor: string
  objectFit: 'cover' | 'contain' | 'fill'
}

export type VideoProps = {
  src?: string
  embedUrl?: string
  provider?: 'upload' | 'youtube' | 'vimeo'
  autoplay: boolean
  muted: boolean
  loop: boolean
  posterUrl?: string
}

export type MapProps = {
  venueName: string
  address: string
  embedUrl: string
  lat?: number
  lng?: number
}

export type AnimationConfig = {
  entrance?: string
  delayMs?: number
  durationMs?: number
}

export type ResponsiveOverride = {
  x?: number
  y?: number
  width?: number
  height?: number
  fontSize?: number
  hidden?: boolean
}

export type BaseElement = {
  id: string
  type: ElementType
  name: string
  transform: ElementTransform
  animation?: AnimationConfig
  responsive?: { mobile?: ResponsiveOverride; tablet?: ResponsiveOverride }
}

export type TextElement = BaseElement & {
  type: 'text'
  content: string
  style: TextStyle
}

export type ImageElement = BaseElement & {
  type: 'image'
  src: string
  alt: string
  /** Set when uploaded via template studio asset API (persists across refresh). */
  assetUuid?: string
  style: ImageStyle
}

export type VideoElement = BaseElement & {
  type: 'video'
  video: VideoProps
}

export type MapElement = BaseElement & {
  type: 'map'
  map: MapProps
}

export type ShapeElement = BaseElement & {
  type: 'shape'
  shape: 'rect' | 'circle'
  fill: string
  stroke: string
  strokeWidth: number
}

export type CountdownStyle = 'split' | 'cards' | 'classic' | 'minimal' | 'dark' | 'elegant'

export type CountdownElement = BaseElement & {
  type: 'countdown'
  targetDate: string
  label: string
  /** Visual layout preset for the live timer. */
  style?: CountdownStyle
}

export type MusicElement = BaseElement & {
  type: 'music'
  audioUrl: string
  title: string
  autoplay: boolean
}

export type RsvpFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select'

export type RsvpField = {
  id: string
  label: string
  type: RsvpFieldType
  required: boolean
  placeholder?: string
  /** Options for select fields. */
  options?: string[]
}

export type RsvpElement = BaseElement & {
  type: 'rsvp'
  heading: string
  submitLabel: string
  fields: RsvpField[]
  successMessage?: string
}

export type GalleryElement = BaseElement & {
  type: 'gallery'
  images: { src: string; alt: string }[]
  columns: number
}

export type CanvasElement =
  | TextElement
  | ImageElement
  | VideoElement
  | MapElement
  | ShapeElement
  | CountdownElement
  | MusicElement
  | RsvpElement
  | GalleryElement

export type TemplatePage = {
  id: string
  name: string
  slug: string
  sectionType: SectionType
  width: number
  height: number
  background: PageBackground
  elements: CanvasElement[]
  transition?: string
}

export type TemplateMeta = {
  id: string
  /** Display title shown in editor, lists, and public site */
  title: string
  /** Legacy/internal name; kept in sync with title */
  name: string
  description: string
  category: 'wedding' | 'engagement' | 'anniversary' | 'custom'
  tags: string[]
  version: number
  marketplaceId?: string
  createdAt: string
  updatedAt: string
}

export type WeddingTemplateDocument = {
  schemaVersion: 1
  meta: TemplateMeta
  pages: TemplatePage[]
  globalFonts: string[]
  settings: {
    snapGrid: number
    showGuides: boolean
    defaultPageSize: { width: number; height: number }
  }
}

export { DEFAULT_PAGE_SIZE, PAGE_ASPECT_RATIO, pageSizeForAspect } from '../lib/pageSize'

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Playfair Display',
  fontSize: 28,
  fill: '#2c1810',
  fontWeight: 'normal',
  fontStyle: 'normal',
  underline: false,
  charSpacing: 0,
  textAlign: 'center',
  lineHeight: 1.35,
}

export const DEFAULT_TRANSFORM = (
  partial?: Partial<ElementTransform>,
): ElementTransform => ({
  x: 80,
  y: 40,
  width: 920,
  height: 64,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  zIndex: 1,
  ...partial,
})
