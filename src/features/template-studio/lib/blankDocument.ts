import { DEFAULT_PAGE_SIZE } from './pageSize'
import { newPageId, newTemplateId } from './ids'
import type { WeddingTemplateDocument } from '../types/schema'

/** Empty single-page 16:9 document for new designs. */
export function createBlankDocument(): WeddingTemplateDocument {
  const pageId = newPageId()
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    meta: {
      id: newTemplateId(),
      title: '',
      name: '',
      description: '',
      category: 'custom',
      tags: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    globalFonts: [],
    settings: {
      snapGrid: 8,
      showGuides: true,
      defaultPageSize: { ...DEFAULT_PAGE_SIZE },
    },
    pages: [
      {
        id: pageId,
        name: 'Page 1',
        slug: 'page-1',
        sectionType: 'custom',
        width: DEFAULT_PAGE_SIZE.width,
        height: DEFAULT_PAGE_SIZE.height,
        background: { type: 'solid', color: '#ffffff' },
        elements: [],
      },
    ],
  }
}
