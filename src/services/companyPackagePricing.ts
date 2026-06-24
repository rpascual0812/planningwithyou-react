import { apiFetch, authHeaders, buildApiUrl } from './api'

export type PackageAdjustmentType = 'percent' | 'fixed'

export type CompanyPackagePricingRow = {
  package_id: number
  package_name: string
  discount: string | null
  discount_type: PackageAdjustmentType
  mark_up: string | null
  mark_up_type: PackageAdjustmentType
  price: string | null
  original_price: string | null
}

export type CompanyPackagePricingRecord = {
  name: string
  packages: CompanyPackagePricingRow[]
}

export type CompanyPackagePricingPayload = {
  name?: string
  packages: {
    package_id: number
    discount?: string | null
    discount_type?: PackageAdjustmentType
    mark_up?: string | null
    mark_up_type?: PackageAdjustmentType
  }[]
}

export async function fetchCompanyPackagePricing(
  companyId: number,
  options?: { supplierDirectory?: boolean },
): Promise<CompanyPackagePricingRecord> {
  const suffix = options?.supplierDirectory ? '?supplier_directory=1' : ''
  const res = await apiFetch(
    buildApiUrl(`/companies/${companyId}/package-pricing/${suffix}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load package pricing')
  return res.json()
}

export async function updateCompanyPackagePricing(
  companyId: number,
  data: CompanyPackagePricingPayload,
  options?: { supplierDirectory?: boolean },
): Promise<CompanyPackagePricingRecord> {
  const suffix = options?.supplierDirectory ? '?supplier_directory=1' : ''
  const res = await apiFetch(
    buildApiUrl(`/companies/${companyId}/package-pricing/${suffix}`),
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data),
    },
  )
  if (!res.ok) throw new Error('Failed to save package pricing')
  return res.json()
}
