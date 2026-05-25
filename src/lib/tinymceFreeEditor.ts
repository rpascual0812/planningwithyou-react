/**
 * Self-hosted TinyMCE OSS (GPL) — no Tiny Cloud API key or paid plugins.
 * @see https://www.tiny.cloud/docs/tinymce/latest/license-key/
 */

export const TINYMCE_GPL_LICENSE_KEY = 'gpl'

/** Pass to TinyMCE `init` for every self-hosted editor instance. */
export const TINYMCE_SELF_HOSTED_FREE_INIT = {
  license_key: TINYMCE_GPL_LICENSE_KEY,
  branding: false,
  promotion: false,
} as const

/** Shared props for `@tinymce/tinymce-react` `Editor`. */
export const TINYMCE_EDITOR_SHARED_PROPS = {
  tinymceScriptSrc: '/tinymce/tinymce.min.js',
  licenseKey: TINYMCE_GPL_LICENSE_KEY,
} as const

/**
 * Plugins bundled with the OSS `tinymce` npm package (no premium add-ons).
 */
export const TINYMCE_OSS_PLUGINS = [
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
  'table',
  'help',
  'wordcount',
] as const
