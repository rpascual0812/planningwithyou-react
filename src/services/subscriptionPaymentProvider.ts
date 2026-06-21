import { apiFetch, authHeaders, buildApiUrl } from './api'
import type { SubscriptionPaymentProviderStatus } from './adminSubscriptionProvider'

export type { SubscriptionPaymentProvider } from './adminSubscriptionProvider'

export async function fetchSubscriptionPaymentProvider(): Promise<SubscriptionPaymentProviderStatus> {
  const res = await apiFetch(buildApiUrl('/subscriptions/payment-provider/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load subscription payment provider')
  return res.json()
}

export const SUBSCRIPTION_PROVIDER_COPY: Record<
  SubscriptionPaymentProviderStatus['provider'],
  { methods: string }
> = {
  paymongo: {
    methods: 'Visa, Mastercard, and Maya',
  },
  xendit: {
    methods: 'Cards, e-wallets, and other Xendit payment methods',
  },
}

export type SubscriptionCheckoutReturnNotice = {
  message: string
  tone: 'success' | 'info' | 'error'
}

export function subscriptionCheckoutReturnNotice(
  providerLabel: string,
  confirm: {
    activated?: boolean
    pending?: boolean
    payment_failed?: boolean
    session_status?: string
    subscription?: { status?: string } | null
  },
): SubscriptionCheckoutReturnNotice {
  if (confirm.activated && confirm.subscription?.status === 'active') {
    return {
      message: 'Your subscription is now active.',
      tone: 'success',
    }
  }

  if (confirm.payment_failed) {
    if (confirm.session_status === 'expired') {
      return {
        message:
          'Your subscription checkout expired before payment was completed. Tap Pay Now to try again.',
        tone: 'error',
      }
    }
    return {
      message: 'Subscription payment failed. Tap Pay Now to try again.',
      tone: 'error',
    }
  }

  if (confirm.pending) {
    return {
      message:
        'Payment was not completed. Tap Pay Now when you are ready to try again.',
      tone: 'info',
    }
  }

  return {
    message: `Payment submitted. Your plan will update once ${providerLabel} confirms the subscription.`,
    tone: 'info',
  }
}

/** @deprecated Use subscriptionCheckoutReturnNotice */
export function subscriptionCheckoutSuccessNotice(
  providerLabel: string,
  confirm: Parameters<typeof subscriptionCheckoutReturnNotice>[1],
): string {
  return subscriptionCheckoutReturnNotice(providerLabel, confirm).message
}
