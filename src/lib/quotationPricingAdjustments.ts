import type { BookingField } from './bookingFieldTypes'
import { bookingPriceSummaryTotal } from './bookingPriceSummary'

export type QuotationDiscountType = 'percent' | 'fixed'

export type QuotationPricingAdjustment = {
  discountAmount: string
  discountType: QuotationDiscountType
  overrideTotalAmount: string
}

export const EMPTY_QUOTATION_PRICING_ADJUSTMENT: QuotationPricingAdjustment = {
  discountAmount: '',
  discountType: 'percent',
  overrideTotalAmount: '',
}

function parseNonNegativeAmount(raw: string | null | undefined): number | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (Number.isNaN(n) || n < 0) return null
  return n
}

export function applyQuotationDiscount(
  subtotal: number,
  amountRaw: string,
  type: QuotationDiscountType,
): number {
  const amount = parseNonNegativeAmount(amountRaw)
  if (amount === null || subtotal <= 0) return subtotal
  let next = subtotal
  if (type === 'percent') {
    const pct = Math.min(amount, 100)
    next = subtotal - (subtotal * pct) / 100
  } else {
    next = subtotal - amount
  }
  return Math.max(0, Math.round(next * 100) / 100)
}

export function computeQuotationEffectiveTotal(
  lineSubtotal: number,
  adjustment: QuotationPricingAdjustment,
): number {
  const override = parseNonNegativeAmount(adjustment.overrideTotalAmount)
  if (override !== null) return override
  if ((adjustment.discountAmount ?? '').trim()) {
    return applyQuotationDiscount(
      lineSubtotal,
      adjustment.discountAmount,
      adjustment.discountType,
    )
  }
  return lineSubtotal
}

export function quotationPricingAdjustmentFromForm(input: {
  discountAmount?: string
  discountType?: QuotationDiscountType
  overrideTotalAmount?: string
}): QuotationPricingAdjustment {
  return {
    discountAmount: (input.discountAmount ?? '').trim(),
    discountType: input.discountType === 'fixed' ? 'fixed' : 'percent',
    overrideTotalAmount: (input.overrideTotalAmount ?? '').trim(),
  }
}

export function quotationPricingPayloadFromForm(
  fields: BookingField[],
  extraGroupNames: string[] = [],
  apiGroups: { id: number; name: string }[] = [],
  adjustment: QuotationPricingAdjustment = EMPTY_QUOTATION_PRICING_ADJUSTMENT,
) {
  const total_amount = quotationEffectiveTotalAmount(
    fields,
    extraGroupNames,
    apiGroups,
    adjustment,
  )
  const hasDiscount = Boolean(adjustment.discountAmount.trim())
  const hasOverride = Boolean(adjustment.overrideTotalAmount.trim())
  return {
    total_amount,
    discount_amount: hasDiscount ? adjustment.discountAmount.trim() : null,
    discount_type: hasDiscount ? adjustment.discountType : '',
    total_override_amount: hasOverride ? adjustment.overrideTotalAmount.trim() : null,
  }
}

export function quotationPricingAdjustmentFromApiItem(item: {
  discount_amount?: string | null
  discount_type?: string | null
  total_override_amount?: string | null
  total_amount?: string | null
}): QuotationPricingAdjustment {
  const discountAmount = (item.discount_amount ?? '').trim()
  const overrideTotalAmount = (item.total_override_amount ?? '').trim()
  return {
    discountAmount,
    discountType: item.discount_type === 'fixed' ? 'fixed' : 'percent',
    overrideTotalAmount,
  }
}

export function quotationEffectiveTotalAmount(
  fields: BookingField[],
  extraGroupNames: string[] = [],
  apiGroups: { id: number; name: string }[] = [],
  adjustment: QuotationPricingAdjustment = EMPTY_QUOTATION_PRICING_ADJUSTMENT,
): string {
  const lineSubtotal = bookingPriceSummaryTotal(fields, extraGroupNames, apiGroups)
  return computeQuotationEffectiveTotal(lineSubtotal, adjustment).toFixed(2)
}

export function inferQuotationOverrideFromStoredTotal(
  lineSubtotal: number,
  storedTotalAmount: string | null | undefined,
): string {
  const stored = parseNonNegativeAmount(storedTotalAmount)
  if (stored === null || lineSubtotal <= 0) return ''
  if (Math.abs(stored - lineSubtotal) < 0.009) return ''
  return stored.toFixed(2)
}

export function validateQuotationDiscount(
  lineSubtotal: number,
  amountRaw: string,
  type: QuotationDiscountType,
): string | null {
  const trimmed = amountRaw.trim()
  if (!trimmed) return 'Enter a discount amount.'
  const amount = Number(trimmed)
  if (Number.isNaN(amount) || amount < 0) {
    return 'Enter a valid discount (0 or greater).'
  }
  if (type === 'percent' && amount > 100) {
    return 'Percent discount cannot exceed 100%.'
  }
  if (type === 'fixed' && lineSubtotal > 0 && amount > lineSubtotal) {
    return 'Fixed discount cannot exceed the line-item subtotal.'
  }
  return null
}

export function validateQuotationOverrideTotal(amountRaw: string): string | null {
  const trimmed = amountRaw.trim()
  if (!trimmed) return 'Enter the override total.'
  const amount = Number(trimmed)
  if (Number.isNaN(amount) || amount < 0) {
    return 'Enter a valid total (0 or greater).'
  }
  return null
}
