/** Subscription slug for AI Plus (matches ``subscriptions.plan``). */
export const AI_PLUS_PLAN = "ai";

export function hasAiPlusSubscription(
  plan: string | null | undefined,
): boolean {
  return plan === AI_PLUS_PLAN;
}
