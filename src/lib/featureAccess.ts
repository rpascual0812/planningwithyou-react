import type { UserRecord } from '../services/users'

export type AccessLevel = 'none' | 'read' | 'write'

export function accessFor(user: UserRecord | null, feature: string): AccessLevel {
  if (!user) return 'none'
  const perms = user.permissions ?? {}
  return perms[feature] ?? 'none'
}

export function canRead(user: UserRecord | null, feature: string): boolean {
  const lvl = accessFor(user, feature)
  return lvl === 'read' || lvl === 'write'
}

export function canWrite(user: UserRecord | null, feature: string): boolean {
  return accessFor(user, feature) === 'write'
}

