import { useRef, useState } from 'react'
import type { LeftToolId } from './leftTools'
import { useTemplateStudioStore } from '../../store/templateStudioStore'
import {
  createBodyText,
  createCountdownWidget,
  createGalleryWidget,
  createHeadingText,
  createImageElement,
  createMapElement,
  createMusicWidget,
  createRsvpWidget,
  createVideoElement,
} from '../../lib/elementFactory'
import { createImageElementFromFile } from '../../lib/imageFit'
import { uploadTemplateImage } from '../../../../services/templateStudioApi'
import AiThemesPanel from './AiThemesPanel'

type LeftPanelProps = {
  tool: Exclude<LeftToolId, null>
}

const ELEMENT_ITEMS = [
  { label: 'Heading', icon: 'bi-type-h1', create: createHeadingText },
  { label: 'Body text', icon: 'bi-text-paragraph', create: createBodyText },
  { label: 'Image', icon: 'bi-image', action: 'image' as const },
  { label: 'Video', icon: 'bi-play-btn', create: createVideoElement },
  { label: 'Map', icon: 'bi-geo-alt', create: createMapElement },
]

const WIDGET_ITEMS = [
  { label: 'Countdown', icon: 'bi-hourglass-split', create: createCountdownWidget },
  { label: 'RSVP', icon: 'bi-envelope-check', create: createRsvpWidget },
  { label: 'Gallery', icon: 'bi-images', create: createGalleryWidget },
  { label: 'Music', icon: 'bi-music-note-beamed', create: createMusicWidget },
]

const LeftPanel = ({ tool }: LeftPanelProps) => {
  const addElement = useTemplateStudioStore((s) => s.addElement)
  const pages = useTemplateStudioStore((s) => s.document.pages)
  const activePageId = useTemplateStudioStore((s) => s.activePageId)
  const setActivePageId = useTemplateStudioStore((s) => s.setActivePageId)
  const addPage = useTemplateStudioStore((s) => s.addPage)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const onImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingImage(true)
    void createImageElementFromFile(file, createImageElement, uploadTemplateImage)
      .then(addElement)
      .catch(() => {
        window.alert('Image upload failed. Please try again.')
      })
      .finally(() => setUploadingImage(false))
  }

  const title =
    tool === 'elements'
      ? 'Elements'
      : tool === 'text'
        ? 'Text'
        : tool === 'widgets'
          ? 'Widgets'
          : tool === 'themes'
            ? 'Design'
            : 'Pages'

  return (
    <aside className="ts-left-panel" aria-label={title}>
      <div className="ts-left-panel-header">
        <h2 className="ts-left-panel-title">{title}</h2>
      </div>
      <div className="ts-left-panel-body">
        {(tool === 'elements' || tool === 'text') && (
          <div className="ts-element-grid">
            {(tool === 'text'
              ? ELEMENT_ITEMS.filter((i) => i.label.includes('text') || i.label === 'Heading')
              : ELEMENT_ITEMS
            ).map((item) => (
              <button
                key={item.label}
                type="button"
                className="ts-element-card"
                onClick={() => {
                  if ('action' in item && item.action === 'image') {
                    if (!uploadingImage) fileRef.current?.click()
                  } else if ('create' in item && item.create) {
                    addElement(item.create())
                  }
                }}
              >
                <span className="ts-element-card-icon">
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                </span>
                <span className="ts-element-card-label">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {tool === 'widgets' && (
          <div className="ts-element-grid">
            {WIDGET_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                className="ts-element-card"
                onClick={() => addElement(item.create())}
              >
                <span className="ts-element-card-icon">
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                </span>
                <span className="ts-element-card-label">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {tool === 'themes' && <AiThemesPanel />}

        {tool === 'pages' && (
          <ul className="ts-page-list">
            {pages.map((page, index) => (
              <li key={page.id}>
                <button
                  type="button"
                  className={`ts-page-list-item${page.id === activePageId ? ' is-active' : ''}`}
                  onClick={() => setActivePageId(page.id)}
                >
                  <span className="ts-page-list-num">{index + 1}</span>
                  <span className="ts-page-list-name">{page.name}</span>
                  <span className="ts-page-list-type">{page.sectionType}</span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="ts-page-list-add"
                onClick={() => addPage(`Page ${pages.length + 1}`)}
              >
                <i className="bi bi-plus-lg" aria-hidden="true" />
                Add page
              </button>
            </li>
          </ul>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={onImageUpload} />
    </aside>
  )
}

export default LeftPanel
