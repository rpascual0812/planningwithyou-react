import {
  TINYMCE_OSS_PLUGINS,
  TINYMCE_SELF_HOSTED_FREE_INIT,
} from './tinymceFreeEditor'

/** TinyMCE init for platform legal HTML documents. */
export const LEGAL_CONTENT_EDITOR_INIT = {
  ...TINYMCE_SELF_HOSTED_FREE_INIT,
  height: 420,
  menubar: false,
  toolbar_mode: 'wrap' as const,
  plugins: [...TINYMCE_OSS_PLUGINS],
  toolbar:
    'undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | link | removeformat code',
  content_style:
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; }',
}
