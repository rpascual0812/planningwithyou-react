import {
  TINYMCE_OSS_PLUGINS,
  TINYMCE_SELF_HOSTED_FREE_INIT,
} from './tinymceFreeEditor'
import {
  EMAIL_MERGE_VARS_TOOLBAR_ITEM,
  registerEmailMergeVariablesToolbar,
} from './tinymceEmailMergeVariables'

/** Compact TinyMCE for support ticket chat replies. */
export const SUPPORT_CHAT_EDITOR_INIT = {
  ...TINYMCE_SELF_HOSTED_FREE_INIT,
  height: 120,
  menubar: false,
  statusbar: false,
  toolbar_mode: 'wrap' as const,
  plugins: [...TINYMCE_OSS_PLUGINS],
  toolbar: `undo redo | bold italic | bullist numlist | ${EMAIL_MERGE_VARS_TOOLBAR_ITEM}`,
  content_style:
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; margin: 8px; }',
  setup: (editor: import('tinymce').Editor) => {
    registerEmailMergeVariablesToolbar(editor)
  },
}
