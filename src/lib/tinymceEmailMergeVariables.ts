import type { Editor } from 'tinymce'

import {
  EMAIL_MERGE_VARIABLES,
  emailMergeVariableToken,
} from '../constants/emailMergeVariables'

const MENU_BUTTON_ID = 'emailmergevars'
const DOCUMENTS_BUTTON_ID = 'documents'

export const EMAIL_BODY_EDITOR_PLUGINS = [
  'advlist',
  'autolink',
  'lists',
  'link',
  'charmap',
  'preview',
  'anchor',
  'searchreplace',
  'visualblocks',
  'code',
  'fullscreen',
  'insertdatetime',
  'media',
  'table',
  'help',
  'wordcount',
] as const

export const EMAIL_BODY_EDITOR_TOOLBAR =
  'undo redo | blocks | bold italic forecolor | ' +
  'alignleft aligncenter alignright alignjustify | ' +
  'bullist numlist outdent indent | link table | ' +
  'documents emailmergevars | removeformat code | help'

export const EMAIL_BODY_CONTENT_STYLE =
  'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; }'

/**
 * Registers a TinyMCE toolbar menu button that lists merge variables and inserts
 * `{key}` at the cursor. Safe to call once per editor inside `setup`.
 */
export function registerEmailMergeVariablesToolbar(editor: Editor): void {
  editor.ui.registry.addMenuButton(MENU_BUTTON_ID, {
    text: 'Variables',
    tooltip: 'Insert merge variable',
    fetch: (callback) => {
      callback(
        EMAIL_MERGE_VARIABLES.map((v) => ({
          type: 'menuitem' as const,
          text: `${v.label} (${emailMergeVariableToken(v.key)})`,
          onAction: () => {
            editor.insertContent(emailMergeVariableToken(v.key))
          },
        })),
      )
    },
  })
}

/** Toolbar button that opens the Documents picker (caller handles insert). */
export function registerEmailDocumentsToolbar(
  editor: Editor,
  onOpenDocuments: () => void,
): void {
  editor.ui.registry.addButton(DOCUMENTS_BUTTON_ID, {
    icon: 'browse',
    tooltip: 'Insert from Documents',
    onAction: onOpenDocuments,
  })
}

export type EmailBodyEditorInitOptions = {
  height?: number
  onOpenDocuments: () => void
}

/** Shared TinyMCE init for email HTML bodies (no image plugin/button). */
export function createEmailBodyEditorInit(options: EmailBodyEditorInitOptions) {
  const height = options.height ?? 350
  return {
    height,
    menubar: false,
    toolbar_mode: 'wrap' as const,
    plugins: [...EMAIL_BODY_EDITOR_PLUGINS],
    toolbar: EMAIL_BODY_EDITOR_TOOLBAR,
    branding: false,
    promotion: false,
    content_style: EMAIL_BODY_CONTENT_STYLE,
    setup: (editor: Editor) => {
      registerEmailDocumentsToolbar(editor, options.onOpenDocuments)
      registerEmailMergeVariablesToolbar(editor)
    },
  }
}

export const EMAIL_MERGE_VARS_TOOLBAR_ITEM = MENU_BUTTON_ID

/** Subject line: only the merge-variables menu; no other toolbar controls. */
export const SUBJECT_VARIABLES_ONLY_EDITOR_INIT = {
  height: 52,
  menubar: false,
  toolbar_mode: 'wrap' as const,
  toolbar: MENU_BUTTON_ID,
  plugins: [] as string[],
  statusbar: false,
  branding: false,
  promotion: false,
  resize: false,
  paste_as_text: true,
  content_style:
    'body { font-family: inherit; font-size: 1rem; margin: 6px; min-height: 1.2em; }',
  setup: (editor: Editor) => {
    registerEmailMergeVariablesToolbar(editor)
  },
}
