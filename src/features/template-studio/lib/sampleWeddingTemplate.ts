import { scaleFontFromLegacy, scaleLayoutFromLegacy } from './pageSize'
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_TEXT_STYLE,
  type WeddingTemplateDocument,
} from '../types/schema'
import { newElementId, newPageId, newTemplateId } from './ids'

const now = new Date().toISOString()

const st = scaleLayoutFromLegacy
const fs = scaleFontFromLegacy

export const SAMPLE_WEDDING_TEMPLATE: WeddingTemplateDocument = {
  schemaVersion: 1,
  meta: {
    id: newTemplateId(),
    title: 'Classic Garden Wedding',
    name: 'Classic Garden Wedding',
    description: 'Elegant multi-section invitation with RSVP, schedule, and venue map.',
    category: 'wedding',
    tags: ['classic', 'garden', 'rsvp'],
    version: 1,
    createdAt: now,
    updatedAt: now,
  },
  globalFonts: ['Playfair Display', 'Cormorant Garamond', 'Lato'],
  settings: {
    snapGrid: 8,
    showGuides: true,
    defaultPageSize: DEFAULT_PAGE_SIZE,
  },
  pages: [
    {
      id: newPageId(),
      name: 'Hero',
      slug: 'hero',
      sectionType: 'hero',
      width: DEFAULT_PAGE_SIZE.width,
      height: DEFAULT_PAGE_SIZE.height,
      background: {
        type: 'gradient',
        gradient: {
          angle: 160,
          stops: [
            { color: '#faf6f0', offset: 0 },
            { color: '#e8dfd2', offset: 1 },
          ],
        },
      },
      elements: [
        {
          id: newElementId(),
          type: 'text',
          name: 'Couple names',
          content: 'Emma & James',
          style: {
            ...DEFAULT_TEXT_STYLE,
            fontFamily: 'Playfair Display',
            fontSize: fs(42),
            fill: '#3d2c1e',
          },
          transform: st({ x: 24, y: 120, width: 342, height: 56, zIndex: 2 }),
        },
        {
          id: newElementId(),
          type: 'text',
          name: 'Wedding date',
          content: 'Saturday, 14 June 2026',
          style: {
            ...DEFAULT_TEXT_STYLE,
            fontFamily: 'Cormorant Garamond',
            fontSize: fs(22),
            fill: '#6b5344',
          },
          transform: st({ x: 24, y: 200, width: 342, height: 40, zIndex: 2 }),
        },
        {
          id: newElementId(),
          type: 'text',
          name: 'Tagline',
          content: 'Together with their families,\ninvite you to celebrate their marriage.',
          style: {
            ...DEFAULT_TEXT_STYLE,
            fontSize: fs(16),
            fill: '#5c4a3a',
            lineHeight: 1.5,
          },
          transform: st({ x: 32, y: 280, width: 326, height: 80, zIndex: 2 }),
        },
        {
          id: newElementId(),
          type: 'countdown',
          name: 'Countdown',
          targetDate: '2026-06-14T16:00:00',
          label: 'Days until we say I do',
          transform: st({ x: 40, y: 400, width: 310, height: 72, zIndex: 2 }),
        },
      ],
      transition: 'fade',
    },
    {
      id: newPageId(),
      name: 'Our Story',
      slug: 'story',
      sectionType: 'story',
      width: DEFAULT_PAGE_SIZE.width,
      height: DEFAULT_PAGE_SIZE.height,
      background: { type: 'solid', color: '#fffdf9' },
      elements: [
        {
          id: newElementId(),
          type: 'text',
          name: 'Story heading',
          content: 'Our Story',
          style: { ...DEFAULT_TEXT_STYLE, fontSize: fs(32), fill: '#3d2c1e' },
          transform: st({ x: 24, y: 48, width: 342, height: 48, zIndex: 1 }),
        },
        {
          id: newElementId(),
          type: 'text',
          name: 'Story body',
          content:
            'We met on a rainy afternoon in Lisbon and have been collecting sunsets ever since. Thank you for being part of our journey.',
          style: {
            ...DEFAULT_TEXT_STYLE,
            fontSize: fs(15),
            textAlign: 'left',
            lineHeight: 1.6,
            fill: '#4a3f35',
          },
          transform: st({ x: 28, y: 120, width: 334, height: 200, zIndex: 1 }),
        },
      ],
    },
    {
      id: newPageId(),
      name: 'Schedule',
      slug: 'schedule',
      sectionType: 'schedule',
      width: DEFAULT_PAGE_SIZE.width,
      height: DEFAULT_PAGE_SIZE.height,
      background: { type: 'solid', color: '#f7f3ed' },
      elements: [
        {
          id: newElementId(),
          type: 'text',
          name: 'Schedule title',
          content: 'Weekend Schedule',
          style: { ...DEFAULT_TEXT_STYLE, fontSize: fs(30) },
          transform: st({ x: 24, y: 40, width: 342, height: 44, zIndex: 1 }),
        },
        {
          id: newElementId(),
          type: 'text',
          name: 'Schedule items',
          content:
            '4:00 PM — Ceremony\nSt. Mary\'s Chapel\n\n6:30 PM — Reception\nRose Garden Estate\n\n10:00 PM — Dancing',
          style: {
            ...DEFAULT_TEXT_STYLE,
            fontSize: fs(15),
            textAlign: 'left',
            lineHeight: 1.7,
          },
          transform: st({ x: 32, y: 110, width: 326, height: 280, zIndex: 1 }),
        },
      ],
    },
    {
      id: newPageId(),
      name: 'RSVP',
      slug: 'rsvp',
      sectionType: 'rsvp',
      width: DEFAULT_PAGE_SIZE.width,
      height: DEFAULT_PAGE_SIZE.height,
      background: { type: 'solid', color: '#fffdf9' },
      elements: [
        {
          id: newElementId(),
          type: 'rsvp',
          name: 'RSVP form',
          heading: 'Kindly respond by 1 May 2026',
          submitLabel: 'Send RSVP',
          transform: st({ x: 24, y: 80, width: 342, height: 420, zIndex: 1 }),
        },
      ],
    },
    {
      id: newPageId(),
      name: 'Gallery',
      slug: 'gallery',
      sectionType: 'gallery',
      width: DEFAULT_PAGE_SIZE.width,
      height: DEFAULT_PAGE_SIZE.height,
      background: { type: 'solid', color: '#faf6f0' },
      elements: [
        {
          id: newElementId(),
          type: 'gallery',
          name: 'Photo gallery',
          images: [],
          columns: 2,
          transform: st({ x: 16, y: 60, width: 358, height: 400, zIndex: 1 }),
        },
      ],
    },
    {
      id: newPageId(),
      name: 'Venue',
      slug: 'venue',
      sectionType: 'venue',
      width: DEFAULT_PAGE_SIZE.width,
      height: DEFAULT_PAGE_SIZE.height,
      background: { type: 'solid', color: '#fffdf9' },
      elements: [
        {
          id: newElementId(),
          type: 'text',
          name: 'Venue title',
          content: 'Find Us',
          style: { ...DEFAULT_TEXT_STYLE, fontSize: fs(28) },
          transform: st({ x: 24, y: 32, width: 342, height: 44, zIndex: 1 }),
        },
        {
          id: newElementId(),
          type: 'map',
          name: 'Venue map',
          map: {
            venueName: 'Rose Garden Estate',
            address: '123 Blossom Lane, Sonoma, CA',
            embedUrl:
              'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3152!2d-122.4!3d38.3!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzjCsDE4JzAwLjAiTiAxMjLCsDI0JzAwLjAiVw!5e0!3m2!1sen!2sus!4v1',
          },
          transform: st({ x: 20, y: 100, width: 350, height: 280, zIndex: 1 }),
        },
      ],
    },
  ],
}
