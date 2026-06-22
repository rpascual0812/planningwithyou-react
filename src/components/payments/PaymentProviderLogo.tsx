type PaymentProviderId = 'paymongo' | 'xendit'

const LOGO_SRC: Record<PaymentProviderId, string> = {
  paymongo: '/assets/images/paymongo-logo.svg',
  xendit: '/assets/images/xendit-logo.svg',
}

const LOGO_ALT: Record<PaymentProviderId, string> = {
  paymongo: 'PayMongo',
  xendit: 'Xendit',
}

export default function PaymentProviderLogo({
  provider,
  className = '',
}: {
  provider: PaymentProviderId
  className?: string
}) {
  return (
    <img
      src={LOGO_SRC[provider]}
      alt={LOGO_ALT[provider]}
      className={`booking-payments-provider-logo${className ? ` ${className}` : ''}`}
      width={provider === 'paymongo' ? 112 : 80}
      height={26}
      loading="lazy"
      decoding="async"
    />
  )
}
