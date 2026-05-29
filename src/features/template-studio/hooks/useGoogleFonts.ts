import { useEffect } from 'react'
import { useTemplateStudioStore } from '../store/templateStudioStore'

const GOOGLE_FONTS = [
  'Playfair Display',
  'Cormorant Garamond',
  'Lato',
  'Great Vibes',
  'Montserrat',
  'Raleway',
]

export { GOOGLE_FONTS }

/** Loads Google Fonts used by the active template. */
export function useGoogleFonts() {
  const fonts = useTemplateStudioStore((s) => s.document.globalFonts)

  useEffect(() => {
    const families = [...new Set([...GOOGLE_FONTS, ...fonts])]
      .map((f) => f.replace(/ /g, '+'))
      .join('&family=')
    const id = 'template-studio-google-fonts'
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    const onFontsLoaded = () => {
      void document.fonts.ready.then(() => {
        useTemplateStudioStore.setState((s) => ({
          canvasRevision: s.canvasRevision + 1,
        }))
      })
    }
    link.onload = onFontsLoaded
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`
    if (link.sheet) onFontsLoaded()
  }, [fonts])
}
