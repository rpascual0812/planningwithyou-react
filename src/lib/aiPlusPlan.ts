import { ADMIN_PLAN, AI_PLUS_PLAN } from "./subscriptionPlans";

export { AI_PLUS_PLAN } from "./subscriptionPlans";

export function hasAiPlusSubscription(
  plan: string | null | undefined,
): boolean {
  return plan === AI_PLUS_PLAN || plan === ADMIN_PLAN;
}
