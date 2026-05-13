/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_JWT_LOGIN_PATH?: string
  /** Defaults to `/api/token/blacklist/` (django-rest-framework-simplejwt). Set empty to skip server logout. */
  readonly VITE_JWT_LOGOUT_PATH?: string
  readonly VITE_DEV_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
