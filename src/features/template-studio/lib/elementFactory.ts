import { newElementId } from './ids'
import { scaleFontFromLegacy, scaleLayoutFromLegacy } from './pageSize'
import {
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  type CanvasElement,
  type ImageElement,
  type MapElement,
  type TextElement,
  type VideoElement,
} from '../types/schema'
import { DEFAULT_RSVP_FIELDS } from './rsvpFields'
import { defaultCountdownTargetDate } from './countdownDate'
import { DEFAULT_COUNTDOWN_STYLE } from './countdownStyles'

export function createDefaultTextElement(
  content: string,
  partial?: Partial<TextElement>,
): TextElement {
  return {
    id: newElementId(),
    type: 'text',
    name: partial?.name ?? 'Text',
    content,
    style: { ...DEFAULT_TEXT_STYLE, ...partial?.style },
    transform: DEFAULT_TRANSFORM(partial?.transform),
    ...partial,
  }
}

export function createHeadingText(): CanvasElement {
  return createDefaultTextElement('Your heading', {
    name: 'Heading',
    style: { ...DEFAULT_TEXT_STYLE, fontSize: scaleFontFromLegacy(36) },
    transform: scaleLayoutFromLegacy({ x: 40, y: 60, width: 310, height: 80 }),
  })
}

export function createBodyText(): CanvasElement {
  return createDefaultTextElement('Add your invitation message here.', {
    name: 'Body text',
    style: { ...DEFAULT_TEXT_STYLE, fontSize: scaleFontFromLegacy(16), textAlign: 'left' },
    transform: scaleLayoutFromLegacy({ x: 32, y: 140, width: 326, height: 120 }),
  })
}

export function createImageElement(src?: string): ImageElement {
  return {
    id: newElementId(),
    type: 'image',
    name: 'Image',
    src: src ?? '',
    alt: '',
    style: { borderRadius: 8, shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.15)', objectFit: 'contain' },
    transform: scaleLayoutFromLegacy({ x: 40, y: 200, width: 310, height: 200, zIndex: 2 }),
  }
}

export function createVideoElement(): VideoElement {
  return {
    id: newElementId(),
    type: 'video',
    name: 'Video',
    video: {
      provider: 'youtube',
      embedUrl: '',
      autoplay: false,
      muted: true,
      loop: false,
    },
    transform: scaleLayoutFromLegacy({ x: 40, y: 240, width: 310, height: 174, zIndex: 2 }),
  }
}

export function createMapElement(): MapElement {
  return {
    id: newElementId(),
    type: 'map',
    name: 'Venue map',
    map: {
      venueName: 'Venue name',
      address: 'Street, City',
      embedUrl: '',
    },
    transform: scaleLayoutFromLegacy({ x: 20, y: 320, width: 350, height: 240, zIndex: 2 }),
  }
}

export function createCountdownWidget(): CanvasElement {
  return {
    id: newElementId(),
    type: 'countdown',
    name: 'Countdown',
    targetDate: defaultCountdownTargetDate(),
    label: 'Days until our wedding',
    style: DEFAULT_COUNTDOWN_STYLE,
    transform: scaleLayoutFromLegacy({ x: 48, y: 360, width: 294, height: 80, zIndex: 2 }),
  }
}

export function createRsvpWidget(): CanvasElement {
  return {
    id: newElementId(),
    type: 'rsvp',
    name: 'RSVP',
    heading: 'Please RSVP',
    submitLabel: 'Submit',
    successMessage: 'Thank you! Your RSVP has been received.',
    fields: DEFAULT_RSVP_FIELDS.map((f) => ({ ...f, id: f.id })),
    transform: scaleLayoutFromLegacy({ x: 24, y: 120, width: 342, height: 400, zIndex: 2 }),
  }
}

export function createGalleryWidget(): CanvasElement {
  return {
    id: newElementId(),
    type: 'gallery',
    name: 'Gallery',
    images: [],
    columns: 2,
    transform: scaleLayoutFromLegacy({ x: 16, y: 80, width: 358, height: 360, zIndex: 2 }),
  }
}

export function createMusicWidget(): CanvasElement {
  return {
    id: newElementId(),
    type: 'music',
    name: 'Music',
    audioUrl: '',
    title: 'Our song',
    autoplay: false,
    transform: scaleLayoutFromLegacy({ x: 280, y: 24, width: 80, height: 48, zIndex: 10 }),
  }
}
