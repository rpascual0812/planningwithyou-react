export type CurrencyFormatOptions = {
  currencyCode: string
  /** From ``countries.currency_symbol`` (via account country). */
  currencySymbol?: string
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
  const numberOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }

  const symbol = (options.currencySymbol ?? '').trim()
  if (symbol) {
    try {
      const formatted = new Intl.NumberFormat(locale, numberOptions).format(amount)
      return `${symbol} ${formatted}`
    } catch {
      const formatted = new Intl.NumberFormat(
        DEFAULT_OPTIONS.locale,
        numberOptions,
      ).format(amount)
      return `${symbol} ${formatted}`
    }
  }

  try {
    return new Intl.NumberFormat(locale, {
      ...numberOptions,
      style: 'currency',
      currency: currencyCode,
    }).format(amount)
  } catch {
    return new Intl.NumberFormat(DEFAULT_OPTIONS.locale, {
      ...numberOptions,
      style: 'currency',
      currency: DEFAULT_OPTIONS.currencyCode,
    }).format(amount)
  }
}

/** Build format options from the current account (account country → countries row). */
export function currencyFormatFromAccount(account: {
  country_currency_code?: string
  country_currency_symbol?: string
  country_iso2_code?: string
}): CurrencyFormatOptions {
  return {
    currencyCode: account.country_currency_code?.trim() || 'USD',
    currencySymbol: account.country_currency_symbol?.trim() || '$',
    locale: localeFromIso2(account.country_iso2_code),
  }
}
