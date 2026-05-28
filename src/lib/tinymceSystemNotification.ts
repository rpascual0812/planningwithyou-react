import {
  TINYMCE_OSS_PLUGINS,
  TINYMCE_SELF_HOSTED_FREE_INIT,
} from './tinymceFreeEditor'
import {
  EMAIL_MERGE_VARS_TOOLBAR_ITEM,
  registerEmailMergeVariablesToolbar,
} from './tinymceEmailMergeVariables'

/** TinyMCE init for system notification messages (no merge variables or documents). */
export const SYSTEM_NOTIFICATION_EDITOR_INIT = {
  ...TINYMCE_SELF_HOSTED_FREE_INIT,
  height: 280,
  menubar: false,
  toolbar_mode: 'wrap' as const,
  plugins: [...TINYMCE_OSS_PLUGINS],
  toolbar:
    `undo redo | blocks | bold italic forecolor | ${EMAIL_MERGE_VARS_TOOLBAR_ITEM}`,
  content_style:
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; }',
  setup: (editor: import('tinymce').Editor) => {
    registerEmailMergeVariablesToolbar(editor)
  },
}
