/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_JWT_LOGIN_PATH?: string
  /** Defaults to `/api/token/refresh/` (SimpleJWT). */
  readonly VITE_JWT_REFRESH_PATH?: string
  /** Defaults to `/api/token/blacklist/` (django-rest-framework-simplejwt). Set empty to skip server logout. */
  readonly VITE_JWT_LOGOUT_PATH?: string
  readonly VITE_DEV_API_PROXY_TARGET?: string
  /** Defaults to `/api/users` (Django `UserViewSet` list). */
  readonly VITE_API_USERS_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
