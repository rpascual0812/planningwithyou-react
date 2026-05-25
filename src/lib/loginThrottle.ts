const STORAGE_PREFIX = 'pwu.loginThrottle.'
export const MAX_LOGIN_FAILURES = 5
const MAX_FAILURES = MAX_LOGIN_FAILURES
const LOCKOUT_MS = 15 * 60 * 1000

type ThrottleRecord = {
  failures: number
  lockedUntil: number | null
}

export class LoginThrottledError extends Error {
  readonly remainingSeconds: number

  constructor(remainingSeconds: number) {
    const mins = Math.ceil(remainingSeconds / 60)
    super(
      remainingSeconds >= 60
        ? `Too many failed login attempts. Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`
        : `Too many failed login attempts. Try again in ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}.`,
    )
    this.name = 'LoginThrottledError'
    this.remainingSeconds = remainingSeconds
  }
}

function storageKey(email: string): string {
  return `${STORAGE_PREFIX}${email.trim().toLowerCase()}`
}

function readRecord(email: string): ThrottleRecord {
  try {
    const raw = sessionStorage.getItem(storageKey(email))
    if (!raw) return { failures: 0, lockedUntil: null }
    const parsed = JSON.parse(raw) as Partial<ThrottleRecord>
    return {
      failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
      lockedUntil:
        typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null,
    }
  } catch {
    return { failures: 0, lockedUntil: null }
  }
}

function writeRecord(email: string, record: ThrottleRecord): void {
  sessionStorage.setItem(storageKey(email), JSON.stringify(record))
}

function clearExpiredLock(record: ThrottleRecord): ThrottleRecord {
  if (record.lockedUntil != null && record.lockedUntil <= Date.now()) {
    return { failures: 0, lockedUntil: null }
  }
  return record
}

export function getLoginLockoutRemainingSeconds(email: string): number {
  const normalized = email.trim()
  if (!normalized) return 0
  const record = clearExpiredLock(readRecord(normalized))
  if (record.lockedUntil == null) return 0
  return Math.max(0, Math.ceil((record.lockedUntil - Date.now()) / 1000))
}

export function isLoginThrottled(email: string): boolean {
  return getLoginLockoutRemainingSeconds(email) > 0
}

export function assertLoginAllowed(email: string): void {
  const remaining = getLoginLockoutRemainingSeconds(email)
  if (remaining > 0) {
    throw new LoginThrottledError(remaining)
  }
}

export function recordLoginFailure(email: string): void {
  const normalized = email.trim()
  if (!normalized) return

  let record = clearExpiredLock(readRecord(normalized))
  if (record.lockedUntil != null) {
    writeRecord(normalized, record)
    return
  }

  record = { ...record, failures: record.failures + 1 }
  if (record.failures >= MAX_FAILURES) {
    record = {
      failures: MAX_FAILURES,
      lockedUntil: Date.now() + LOCKOUT_MS,
    }
  }
  writeRecord(normalized, record)
}

export function clearLoginThrottle(email: string): void {
  const normalized = email.trim()
  if (!normalized) return
  sessionStorage.removeItem(storageKey(normalized))
}

export function loginAttemptsRemaining(email: string): number {
  const normalized = email.trim()
  if (!normalized) return MAX_FAILURES
  const record = clearExpiredLock(readRecord(normalized))
  if (record.lockedUntil != null) return 0
  return Math.max(0, MAX_FAILURES - record.failures)
}
