/** Subscription plan slugs (match ``subscriptions.plan``). */
export const FREE_PLAN = 'free'
export const ADMIN_PLAN = 'admin'
export const AI_PLUS_PLAN = 'ai'

export function isLifetimePlan(plan: string | null | undefined): boolean {
  return plan === FREE_PLAN || plan === ADMIN_PLAN
}

/** Pro, AI Plus, Admin, and other non-free plans unlock paid tenant features. */
export function planGrantsPaidFeatures(
  plan: string | null | undefined,
): boolean {
  return plan != null && plan !== FREE_PLAN
}
