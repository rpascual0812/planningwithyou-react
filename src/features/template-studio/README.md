# Invitations (editor)

Canva-style wedding invitation website builder integrated into Planning With You.

## Install

Dependencies are already listed in the root `package.json`:

```bash
npm install fabric zustand
```

## Folder structure

```
src/features/template-studio/
├── TemplateStudioEditor.tsx      # Main editor shell
├── types/schema.ts               # JSON document schema (SaaS-ready)
├── store/templateStudioStore.ts  # Zustand state + undo/redo
├── hooks/
│   ├── useFabricCanvas.ts        # Fabric.js ↔ store sync
│   ├── useAutoSave.ts            # Debounced localStorage
│   ├── useKeyboardShortcuts.ts   # Undo/redo/delete/duplicate
│   └── useGoogleFonts.ts         # Dynamic Google Fonts loader
├── lib/
│   ├── fabricSync.ts             # Element → Fabric object mapping
│   ├── elementFactory.ts         # Add-element helpers
│   ├── sampleWeddingTemplate.ts  # Sample multi-section template
│   ├── templateSerializer.ts     # JSON import/export
│   └── background.ts
├── components/
│   ├── canvas/FabricCanvasStage.tsx
│   ├── toolbar/TopToolbar.tsx
│   └── sidebar/
│       ├── ElementsSidebar.tsx
│       ├── PropertiesPanel.tsx
│       └── PagesPanel.tsx
└── styles/template-studio.css

src/pages/TemplateStudioPage.tsx
src/services/templateStudioApi.ts   # Future REST API stub
```

## Usage

Route: `/invitations` (sidebar **Invitations**, permission `template_studio`).

```tsx
import TemplateStudioEditor from './features/template-studio/TemplateStudioEditor'

export default function Page() {
  return <TemplateStudioEditor />
}
```

## JSON schema

Documents use `WeddingTemplateDocument` (`schemaVersion: 1`) with:

- `meta` — name, category, marketplace fields
- `pages[]` — sections (hero, story, RSVP, gallery, venue, …)
- `elements[]` per page — text, image, video, map, widgets
- `transform` — x/y/width/height/rotation/zIndex
- `background` — solid, gradient, image, video + overlay/blur

Export/import via toolbar **Export JSON** / **Import**. Auto-save writes to `localStorage` key `template-studio:draft`.

## Rendering public sites

1. **Editor** — Fabric.js canvas for WYSIWYG positioning.
2. **Published site** — separate React renderer (recommended) that maps the same JSON to DOM:
   - Text → styled `<div>` / `<h1>`
   - Images/video/map → `<img>`, `<iframe>`, responsive containers
   - RSVP/countdown/gallery → dedicated widget components
3. **API** — `GET /api/public/invitations/:slug/` returns frozen JSON; CDN + SSR optional.

See `src/services/templateStudioApi.ts` for suggested backend endpoints.

## Performance

- Zustand selectors limit re-renders
- Debounced auto-save (2s)
- Fabric canvas rebuild only on page/element changes
- `structuredClone` for history snapshots (cap 50)

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Y / Shift+Z | Redo |
| Delete | Delete selection |
| Ctrl/Cmd+D | Duplicate |

## Backend permission

Run migration `users.0031_template_studio_permission` and grant `template_studio` on roles (Owner gets write by default).
