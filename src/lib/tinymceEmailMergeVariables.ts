import type { Editor } from 'tinymce'

import {
  EMAIL_MERGE_VARIABLES,
  emailMergeVariableToken,
} from '../constants/emailMergeVariables'

const MENU_BUTTON_ID = 'emailmergevars'

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
