import type { Address, ContactRecord, PhoneNumber } from '../services/contacts'

/** Booking API returns contact as a numeric id; normalize for form state. */
export function normalizeContactId(contact: unknown): number | null {
  if (contact == null || contact === '') return null
  if (typeof contact === 'number' && !Number.isNaN(contact)) return contact
  if (typeof contact === 'string') {
    const n = Number(contact)
    return Number.isNaN(n) ? null : n
  }
  return null
}

export function contactDisplayName(contact: ContactRecord): string {
  const name = `${contact.first_name} ${contact.last_name}`.trim()
  if (name) return name
  if (contact.email) return contact.email
  if (contact.company) return contact.company
  return `Contact #${contact.id}`
}

export function contactDefaultPhone(contact: ContactRecord): PhoneNumber | null {
  const phones = contact.phone_numbers ?? []
  if (phones.length === 0) return null
  return phones.find((p) => p.is_default) ?? phones[0]
}

export function contactDefaultAddress(contact: ContactRecord): Address | null {
  const addresses = contact.addresses ?? []
  if (addresses.length === 0) return null
  return addresses.find((a) => a.is_default) ?? addresses[0]
}

export function contactMobileNumber(contact: ContactRecord): string {
  const phone = contactDefaultPhone(contact)
  return phone?.number?.trim() ?? ''
}

export function formatContactAddress(address: Address): string {
  const parts = [
    address.street,
    address.city,
    address.state,
    address.zip_code,
    address.country,
  ].map((p) => (p ?? '').trim()).filter(Boolean)
  return parts.join(', ')
}

export function contactPrimaryAddress(contact: ContactRecord): string {
  const address = contactDefaultAddress(contact)
  return address ? formatContactAddress(address) : ''
}

export function contactAddressLabel(address: Address): string {
  if (address.label === 'home') return 'Home'
  if (address.label === 'work') return 'Work'
  return 'Other'
}

export function contactPhoneLabel(phone: PhoneNumber): string {
  if (phone.label === 'mobile') return 'Mobile'
  if (phone.label === 'home') return 'Home'
  if (phone.label === 'work') return 'Work'
  return 'Phone'
}
