export type CurrencyFormatOptions = {
  currencyCode: string
  locale?: string
}

const DEFAULT_OPTIONS: CurrencyFormatOptions = {
  currencyCode: 'USD',
  locale: 'en-US',
}

export function localeFromIso2(iso2: string | undefined): string {
  if (!iso2 || iso2.length !== 2) return DEFAULT_OPTIONS.locale!
  return `en-${iso2.toUpperCase()}`
}

export function formatCurrency(
  amount: number,
  options: Partial<CurrencyFormatOptions> = {},
): string {
  const currencyCode = options.currencyCode ?? DEFAULT_OPTIONS.currencyCode
  const locale = options.locale ?? DEFAULT_OPTIONS.locale
  const hasFraction = Math.abs(amount % 1) > 0.000001
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return new Intl.NumberFormat(DEFAULT_OPTIONS.locale, {
      style: 'currency',
      currency: DEFAULT_OPTIONS.currencyCode,
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amount)
  }
}
