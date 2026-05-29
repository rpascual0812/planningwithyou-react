import { useRef } from 'react'
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

type ElementButton = {
  label: string
  icon: string
  onAdd: () => void
}

const ElementsSidebar = () => {
  const addElement = useTemplateStudioStore((s) => s.addElement)
  const fileRef = useRef<HTMLInputElement>(null)

  const buttons: ElementButton[] = [
    { label: 'Heading', icon: 'bi-type-h1', onAdd: () => addElement(createHeadingText()) },
    { label: 'Text', icon: 'bi-fonts', onAdd: () => addElement(createBodyText()) },
    {
      label: 'Image',
      icon: 'bi-image',
      onAdd: () => {
        fileRef.current?.click()
      },
    },
    { label: 'Video', icon: 'bi-camera-video', onAdd: () => addElement(createVideoElement()) },
    { label: 'Map', icon: 'bi-geo-alt', onAdd: () => addElement(createMapElement()) },
    { label: 'Countdown', icon: 'bi-hourglass-split', onAdd: () => addElement(createCountdownWidget()) },
    { label: 'RSVP', icon: 'bi-envelope-check', onAdd: () => addElement(createRsvpWidget()) },
    { label: 'Gallery', icon: 'bi-images', onAdd: () => addElement(createGalleryWidget()) },
    { label: 'Music', icon: 'bi-music-note-beamed', onAdd: () => addElement(createMusicWidget()) },
  ]

  const onImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    void createImageElementFromFile(file, createImageElement, uploadTemplateImage)
      .then(addElement)
      .catch(() => {
        window.alert('Image upload failed. Please try again.')
      })
  }

  return (
    <aside className="ts-sidebar ts-sidebar--left border-end bg-white p-3" aria-label="Elements">
      <h6 className="text-uppercase text-muted small fw-semibold mb-3">Elements</h6>
      <div className="d-grid gap-2">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            className="btn btn-sm btn-outline-dark text-start d-flex align-items-center gap-2"
            onClick={b.onAdd}
          >
            <i className={`bi ${b.icon}`} aria-hidden="true" />
            {b.label}
          </button>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={onImageUpload} />
      <p className="text-muted small mt-4 mb-0">
        Drag elements on the canvas to position them freely. Double-click text to edit inline.
      </p>
    </aside>
  )
}

export default ElementsSidebar
