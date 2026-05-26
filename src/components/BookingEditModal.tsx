import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import type { DragEvent, SubmitEvent } from 'react'
import {
  FIELD_TYPE_OPTIONS,
  type FieldType,
} from '../services/formTemplates'
import { storedValueToTimeInput, timeInputToStored } from '../lib/timeInput'
import {
  DEFAULT_BOOKING_GROUP_NAME,
  mergeBookingFieldGroups,
  normalizeBookingGroupName,
} from '../lib/bookingFieldGroups'
import type { BookingField, BookingFieldOption } from '../lib/bookingFieldTypes'
import {
  bookingPriceSummaryRequiredDownpayment,
  bookingStoredTotalAmountHasValue,
  getBookingGroupSubtotalMap,
  getBookingPriceGroups,
  resolveBookingFieldPriceRaw,
  sumBookingPriceGroups,
  validateBookingFieldDownpayment,
  validateBookingSupplierFieldDownpayment,
} from '../lib/bookingPriceSummary'
import { fetchBookingsGroupNameConfig } from '../services/config'
import { fetchCurrentAccount } from '../services/accounts'
import {
  currencyFormatFromAccount,
  formatCurrency,
  type CurrencyFormatOptions,
} from '../utils/currency'
import BookingHistoryPanel from './BookingHistoryPanel'
import BookingPaymentsModal from './BookingPaymentsModal'
import ContactFormModal from './ContactFormModal'
import SupplierFieldInput from './SupplierFieldInput'
import {
  EMPTY_CONTACT_FORM,
  validateContactPayload,
} from '../lib/contactForm'
import {
  createContact,
  fetchContact,
  fetchContacts,
  type ContactPayload,
  type ContactRecord,
} from '../services/contacts'
import { fetchCompanies, type CompanyRecord } from '../services/companies'
import { fetchMe, type UserRecord } from '../services/users'
import {
  contactAddressLabel,
  contactDefaultAddress,
  contactDefaultPhone,
  contactDisplayName,
  contactPhoneLabel,
  formatContactAddress,
} from '../lib/contactDisplay'
import EmailSenderModal from './EmailSenderModal'
import { applyEmailMergeVariables } from '../lib/applyEmailMergeVariables'
import { buildEmailMergeContext } from '../lib/emailMergeContext'
import {
  fetchBookingPaymentLinks,
} from '../services/bookingPaymentLinks'
import { sendEmail, type EmailPayload } from '../services/emails'
import { fetchBookingItem } from '../services/bookings'
import { fetchSecuredFileBlobUrl } from '../lib/securedFileUrl'
import { showErrorToast, showSuccessToast } from '../utils/toast'

export type { BookingField, BookingFieldOption } from '../lib/bookingFieldTypes'

export type BookingFormState = {
  mode: 'create' | 'edit'
  id: number | null
  /** ``bookings.unique_id`` (edit only). */
  uniqueId?: string
  statusId: number
  contactId: number | null
  title: string
  dateOfEvent: string
  timeOfEvent: string
  fields: BookingField[]
  /** Empty group accordions (no fields yet); persisted via booking ``groups`` on save. */
  extraGroupNames?: string[]
  notes: string
  /** Public URL for the generated booking quote PDF, when available. */
  pdfUrl?: string
  /** Persisted ``bookings.total_amount`` (set after save). */
  totalAmount?: string
  /** Persisted ``bookings.required_downpayment_amount`` (set after save). */
  requiredDownpaymentAmount?: string
  /** Sum of successful ``booking_payments`` base credited (edit). */
  paidAmount?: string
  paidChargeAmount?: string
  paidProcessingFees?: string
  paidPlatformFees?: string
  /** False when another company appears on the booking; view-only in the UI. */
  canEdit?: boolean
  /** Owner company name (``bookings.company_id``); shown in view-only mode. */
  companyName?: string
}

export type BookingStatus = {
  id: number
  title: string
}

export type BookingTemplateField = {
  label: string
  field_type: FieldType
  is_required: boolean
  options: { label: string; price: string | null; sort_order: number }[]
  price: string | null
  sort_order: number
}

export type BookingTemplate = {
  id: number
  name: string
  is_default: boolean
  fields: BookingTemplateField[]
}

export type BookingGroupRef = {
  id: number
  name: string
}

type BookingEditModalProps = {
  form: BookingFormState
  statuses: BookingStatus[]
  templates: BookingTemplate[]
  bookingGroups?: BookingGroupRef[]
  onChange: (next: BookingFormState) => void
  onDeleteGroup?: (bookingId: number, groupId: number) => Promise<void>
  onClose: () => void
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void | Promise<void>
  onSendToCalendar?: () => void
  historyRefreshKey?: number
  /** When false, the modal is view-only (no save / field edits). */
  canWrite?: boolean
}

const EMPTY_FIELD: BookingField = {
  label: '',
  group_name: DEFAULT_BOOKING_GROUP_NAME,
  field_type: 'text',
  is_required: false,
  options: [],
  price: null,
  requiredDownpayment: null,
  sort_order: 0,
  saved: false,
  value: '',
}

const EMPTY_OPTION: BookingField['options'][number] = {
  label: '',
  price: null,
  sort_order: 0,
}

const DRAFT_KEY_PREFIX = 'bookingDraft:'

type DraftData = Omit<BookingFormState, 'mode' | 'id'>

function draftKey(bookingId: number | null): string {
  const idPart = bookingId != null ? String(bookingId) : 'new'
  return `${DRAFT_KEY_PREFIX}${idPart}`
}

function loadDraft(key: string): DraftData | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as DraftData) : null
  } catch {
    return null
  }
}

function saveDraft(key: string, form: BookingFormState) {
  try {
    const { mode: _, id: __, ...data } = form
    localStorage.setItem(key, JSON.stringify(data))
  } catch { /* quota exceeded */ }
}

function isDraftNonEmpty(data: Partial<BookingFormState>): boolean {
  if (data.title && data.title.trim()) return true
  if (data.dateOfEvent && data.dateOfEvent.trim()) return true
  if (data.timeOfEvent && data.timeOfEvent.trim()) return true
  if (data.notes && data.notes.trim()) return true
  if (data.contactId != null) return true
  if (data.fields && data.fields.length > 0) return true
  return false
}

export function clearBookingDraft(bookingId: number | null) {
  localStorage.removeItem(draftKey(bookingId))
}

const BookingEditModal = ({
  form,
  statuses,
  templates,
  bookingGroups = [],
  onChange,
  onDeleteGroup,
  onClose,
  onSubmit,
  onSendToCalendar,
  historyRefreshKey = 0,
  canWrite = true,
}: BookingEditModalProps) => {
  const viewOnly =
    !canWrite || (form.mode === 'edit' && form.canEdit === false)
  const showHistoryTab = form.mode === 'edit' && form.id != null

  useEffect(() => {
    setModalTab('details')
  }, [form.id, form.mode])
  const readOnlyFieldProps = viewOnly
    ? ({ readOnly: true, disabled: true } as const)
    : {}
  const [fieldDragOver, setFieldDragOver] = useState<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [restoredDraft, setRestoredDraft] = useState(false)
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyFormatOptions>({
    currencyCode: 'USD',
    locale: 'en-US',
  })
  const [contacts, setContacts] = useState<ContactRecord[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [linkedContact, setLinkedContact] = useState<ContactRecord | null>(null)
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [addContactForm, setAddContactForm] = useState<ContactPayload>({
    ...EMPTY_CONTACT_FORM,
  })
  const [addContactError, setAddContactError] = useState<string | null>(null)
  const [addContactSaving, setAddContactSaving] = useState(false)
  const [userCompanyId, setUserCompanyId] = useState<number | null>(null)
  const [emailMergeUser, setEmailMergeUser] = useState<UserRecord | null>(null)
  const [emailMergeCompany, setEmailMergeCompany] = useState<CompanyRecord | null>(
    null,
  )
  const [modalTab, setModalTab] = useState<'details' | 'history'>('details')
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailPaymentLinkMode, setEmailPaymentLinkMode] = useState(false)
  const [paymentLinkUrlForEmail, setPaymentLinkUrlForEmail] = useState<string | null>(
    null,
  )
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [defaultGroupName, setDefaultGroupName] = useState(DEFAULT_BOOKING_GROUP_NAME)
  const [extraGroupNames, setExtraGroupNames] = useState<string[]>(
    form.extraGroupNames ?? [],
  )
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  type GroupNameModal =
    | { type: 'add' }
    | { type: 'edit'; originalName: string }
    | null
  const [groupNameModal, setGroupNameModal] = useState<GroupNameModal>(null)
  const [groupNameInput, setGroupNameInput] = useState('')
  const [groupNameError, setGroupNameError] = useState<string | null>(null)
  const [addGroupTemplateId, setAddGroupTemplateId] = useState<number | null>(null)
  /** API group names hidden after rename until the booking is saved. */
  const [dismissedApiGroupNames, setDismissedApiGroupNames] = useState<string[]>([])
  const originalFormJson = useRef(JSON.stringify(form))
  const groupLabel = defaultGroupName
  const skipSave = useRef(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchCurrentAccount(), fetchBookingsGroupNameConfig()])
      .then(([account, groupConfig]) => {
        if (cancelled) return
        setCurrencyOptions(currencyFormatFromAccount(account))
        const name = groupConfig.value?.trim()
        if (name) setDefaultGroupName(name)
      })
      .catch(() => {
        // Keep defaults.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchMe(), fetchCompanies()])
      .then(([user, companies]) => {
        if (cancelled) return
        setUserCompanyId(user.company)
        setEmailMergeUser(user)
        const company =
          user.company != null
            ? companies.find((c) => c.id === user.company) ?? null
            : null
        setEmailMergeCompany(company)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setContactsLoading(true)
    fetchContacts()
      .then((rows) => {
        if (!cancelled) setContacts(rows)
      })
      .catch(() => {
        if (!cancelled) setContacts([])
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const reloadContacts = useCallback(async () => {
    setContactsLoading(true)
    try {
      setContacts(await fetchContacts())
    } catch {
      setContacts([])
    } finally {
      setContactsLoading(false)
    }
  }, [])

  const openAddContact = () => {
    setAddContactForm({
      ...EMPTY_CONTACT_FORM,
      company_id: userCompanyId,
    })
    setAddContactError(null)
    setAddContactOpen(true)
  }

  const closeAddContact = () => {
    setAddContactOpen(false)
    setAddContactError(null)
  }

  const handleAddContactSave = async () => {
    setAddContactError(null)
    const validated = validateContactPayload(addContactForm)
    if (validated.ok === false) {
      setAddContactError(validated.error)
      return
    }
    setAddContactSaving(true)
    try {
      const created = await createContact(validated.payload)
      await reloadContacts()
      onChange({ ...form, contactId: created.id })
      setLinkedContact(created)
      closeAddContact()
      showSuccessToast('Contact created.')
    } catch (e) {
      setAddContactError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setAddContactSaving(false)
    }
  }

  const setAddContactField = <K extends keyof ContactPayload>(
    key: K,
    val: ContactPayload[K],
  ) => setAddContactForm((prev) => ({ ...prev, [key]: val }))

  useEffect(() => {
    let cancelled = false
    const contactId = form.contactId
    if (contactId == null) {
      setLinkedContact(null)
      return
    }
    fetchContact(contactId)
      .then((contact) => {
        if (cancelled) return
        setLinkedContact(contact)
        setContacts((prev) => {
          const idx = prev.findIndex((c) => c.id === contact.id)
          if (idx === -1) return [...prev, contact]
          const next = [...prev]
          next[idx] = contact
          return next
        })
      })
      .catch(() => {
        if (!cancelled) setLinkedContact(null)
      })
    return () => {
      cancelled = true
    }
  }, [form.contactId])

  const selectedContact = useMemo(() => {
    if (form.contactId == null) return null
    const id = Number(form.contactId)
    if (linkedContact?.id === id) return linkedContact
    return contacts.find((c) => c.id === id) ?? null
  }, [contacts, form.contactId, linkedContact])

  const defaultContactPhone = useMemo(
    () => (selectedContact ? contactDefaultPhone(selectedContact) : null),
    [selectedContact],
  )

  const defaultContactAddress = useMemo(
    () => (selectedContact ? contactDefaultAddress(selectedContact) : null),
    [selectedContact],
  )

  const bookingEmailDefaults = useMemo((): Partial<EmailPayload> => {
    const to = selectedContact?.email?.trim()
    const subject = form.title.trim()
      ? `Booking: ${form.title.trim()}`
      : 'Booking details'
    return {
      to: to ? [to] : [],
      subject,
      attachments: form.pdfUrl ? [form.pdfUrl] : [],
    }
  }, [selectedContact, form.title, form.pdfUrl])

  const paymentLinkEmailDefaults = useMemo((): Partial<EmailPayload> => {
    const to = selectedContact?.email?.trim()
    return {
      to: to ? [to] : [],
      subject: '',
      body: '',
      attachments: [],
    }
  }, [selectedContact])

  const openPaymentLinkEmailModal = (link: { public_url: string }) => {
    const to = selectedContact?.email?.trim()
    if (!to) {
      showErrorToast('Add a contact with an email address before sending the payment link.')
      return
    }
    setEmailError(null)
    setPaymentLinkUrlForEmail(link.public_url)
    setEmailPaymentLinkMode(true)
    setEmailModalOpen(true)
  }

  const openBookingEmailModal = async () => {
    setEmailPaymentLinkMode(false)
    setPaymentLinkUrlForEmail(null)
    setEmailError(null)
    if (form.id) {
      try {
        const item = await fetchBookingItem(form.id)
        const pdfUrl = item.pdf_url ?? ''
        if (pdfUrl !== (form.pdfUrl ?? '')) {
          onChange({ ...form, pdfUrl })
        }
      } catch {
        // Keep any pdfUrl already on the form.
      }
    }
    setEmailModalOpen(true)
  }

  const handleDownloadBookingPdf = async () => {
    setPdfDownloading(true)
    try {
      let pdfUrl = (form.pdfUrl ?? '').trim()
      if (form.id) {
        try {
          const item = await fetchBookingItem(form.id)
          pdfUrl = (item.pdf_url ?? '').trim()
          if (pdfUrl !== (form.pdfUrl ?? '').trim()) {
            onChange({ ...form, pdfUrl })
          }
        } catch {
          /* keep form.pdfUrl */
        }
      }
      if (!pdfUrl) {
        showErrorToast(
          'PDF is not available yet. Save the booking and wait a moment, then try again.',
        )
        return
      }
      const objectUrl = await fetchSecuredFileBlobUrl(pdfUrl)
      try {
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = 'bookings.pdf'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    } catch {
      showErrorToast('Could not download the booking PDF.')
    } finally {
      setPdfDownloading(false)
    }
  }

  const handleBookingEmailSend = async (data: EmailPayload) => {
    setEmailSending(true)
    setEmailError(null)
    try {
      let paymentUrl = (paymentLinkUrlForEmail ?? '').trim()
      if (!paymentUrl && form.id != null) {
        try {
          const { links: paymentLinks } = await fetchBookingPaymentLinks(form.id)
          const pending = paymentLinks.find((l) => l.status === 'pending')
          paymentUrl = (pending ?? paymentLinks[0])?.public_url ?? ''
        } catch {
          paymentUrl = ''
        }
      }
      const mergeContext = buildEmailMergeContext({
        user: emailMergeUser,
        company: emailMergeCompany,
        paymentLinkUrl: paymentUrl,
      })
      const payload: EmailPayload = {
        ...data,
        subject: applyEmailMergeVariables(data.subject ?? '', mergeContext),
        body: applyEmailMergeVariables(data.body ?? '', mergeContext),
      }
      await sendEmail(payload)
      setEmailModalOpen(false)
      setEmailPaymentLinkMode(false)
      setPaymentLinkUrlForEmail(null)
      showSuccessToast('Email queued for delivery.')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setEmailSending(false)
    }
  }

  useEffect(() => {
    setDismissedApiGroupNames([])
  }, [form.id, form.mode])

  const dismissedApiGroupSet = useMemo(
    () => new Set(dismissedApiGroupNames.map(normalizeBookingGroupName)),
    [dismissedApiGroupNames],
  )

  const activeApiGroups = useMemo(
    () =>
      bookingGroups.filter(
        (g) => !dismissedApiGroupSet.has(normalizeBookingGroupName(g.name)),
      ),
    [bookingGroups, dismissedApiGroupSet],
  )

  const groupIdByName = useMemo(() => {
    const map = new Map<string, number>()
    for (const group of activeApiGroups) {
      map.set(normalizeBookingGroupName(group.name), group.id)
    }
    for (const field of form.fields) {
      if (field.booking_group_id != null) {
        map.set(normalizeBookingGroupName(field.group_name), field.booking_group_id)
      }
    }
    return map
  }, [activeApiGroups, form.fields])

  const fieldGroups = useMemo(
    () => mergeBookingFieldGroups(form.fields, extraGroupNames, activeApiGroups),
    [form.fields, extraGroupNames, activeApiGroups],
  )

  useEffect(() => {
    const namesWithFields = new Set(
      form.fields.map((f) => normalizeBookingGroupName(f.group_name)),
    )
    const emptyFromApi = activeApiGroups
      .map((g) => normalizeBookingGroupName(g.name))
      .filter((name) => !namesWithFields.has(name))
    if (emptyFromApi.length === 0) return
    setExtraGroupNames((prev) => {
      const merged = [...prev]
      let changed = false
      for (const name of emptyFromApi) {
        if (!merged.includes(name)) {
          merged.push(name)
          changed = true
        }
      }
      return changed ? merged : prev
    })
  }, [activeApiGroups, form.fields])

  const fieldGroupNamesKey = useMemo(
    () => fieldGroups.map((g) => g.groupName).join('\0'),
    [fieldGroups],
  )

  const accordionSessionKey = `${form.mode}:${form.id ?? 'new'}`
  const multiGroupAccordionInitRef = useRef<string | null>(null)

  useEffect(() => {
    multiGroupAccordionInitRef.current = null
  }, [accordionSessionKey])

  useEffect(() => {
    if (fieldGroups.length === 0) {
      setOpenGroups({})
    }
  }, [fieldGroupNamesKey, fieldGroups.length])

  useEffect(() => {
    if (fieldGroups.length !== 1) return
    const name = fieldGroups[0].groupName
    setOpenGroups((prev) =>
      prev[name] === true && Object.keys(prev).length === 1
        ? prev
        : { [name]: true },
    )
  }, [fieldGroupNamesKey, fieldGroups.length, fieldGroups])

  useEffect(() => {
    if (fieldGroups.length <= 1) return

    if (multiGroupAccordionInitRef.current !== accordionSessionKey) {
      const next: Record<string, boolean> = {}
      for (const group of fieldGroups) {
        next[group.groupName] = false
      }
      setOpenGroups(next)
      multiGroupAccordionInitRef.current = accordionSessionKey
      return
    }

    setOpenGroups((prev) => {
      const next = { ...prev }
      let changed = false
      for (const group of fieldGroups) {
        if (next[group.groupName] === undefined) {
          next[group.groupName] = false
          changed = true
        }
      }
      for (const key of Object.keys(next)) {
        if (!fieldGroups.some((g) => g.groupName === key)) {
          delete next[key]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [accordionSessionKey, fieldGroupNamesKey, fieldGroups])

  const priceGroups = useMemo(
    () => getBookingPriceGroups(fieldGroups),
    [fieldGroups],
  )
  const showPaymentsButton =
    !viewOnly &&
    form.mode === 'edit' &&
    form.id != null &&
    bookingStoredTotalAmountHasValue(form.totalAmount)

  const storedBookingTotal = useMemo(() => {
    const raw = (form.totalAmount ?? '').trim()
    const n = Number(raw)
    return !Number.isNaN(n) && n > 0 ? n : 0
  }, [form.totalAmount])

  const priceTotal = useMemo(
    () => sumBookingPriceGroups(priceGroups),
    [priceGroups],
  )
  const requiredDownpaymentTotal = useMemo(
    () => bookingPriceSummaryRequiredDownpayment(form.fields),
    [form.fields],
  )
  const parseAmount = (raw: string | undefined): number => {
    const n = Number((raw ?? '').trim())
    return !Number.isNaN(n) && n >= 0 ? n : 0
  }
  const paidTotal = useMemo(() => parseAmount(form.paidAmount), [form.paidAmount])
  const paidChargeTotal = useMemo(
    () => parseAmount(form.paidChargeAmount),
    [form.paidChargeAmount],
  )
  const paidProcessingTotal = useMemo(
    () => parseAmount(form.paidProcessingFees),
    [form.paidProcessingFees],
  )
  const paidPlatformTotal = useMemo(
    () => parseAmount(form.paidPlatformFees),
    [form.paidPlatformFees],
  )
  const balanceTotal =
    storedBookingTotal > 0 ? storedBookingTotal : priceTotal
  const remainingBalance = Math.max(0, balanceTotal - paidTotal)
  const showPaymentBalance =
    form.mode === 'edit' && form.id != null && balanceTotal > 0
  const groupSubtotals = useMemo(
    () => getBookingGroupSubtotalMap(fieldGroups),
    [fieldGroups],
  )

  const formatFieldPriceAmount = (raw: string | null | undefined): string | null => {
    if (raw === null || raw === undefined || raw === '') return null
    const amount = Number(raw)
    if (Number.isNaN(amount)) return String(raw)
    return formatCurrency(amount, currencyOptions)
  }

  const getSavedFieldDisplayPrice = (field: BookingField): string | null =>
    formatFieldPriceAmount(resolveBookingFieldPriceRaw(field))

  const getSavedFieldDisplayDownpayment = (field: BookingField): string | null => {
    if (!field.saved || field.field_type === 'supplier') return null
    const raw = field.requiredDownpayment
    if (raw === null || raw === undefined || raw === '') return null
    return formatFieldPriceAmount(raw)
  }

  // Restore draft on mount (create only — edit keeps server contact/status)
  useEffect(() => {
    originalFormJson.current = JSON.stringify(form)
    if (form.mode !== 'create') return
    const key = draftKey(form.id)
    const draft = loadDraft(key)
    if (draft && isDraftNonEmpty(draft)) {
      onChange({ ...form, ...draft })
      setRestoredDraft(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save draft on every form change (skip initial render)
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    const key = draftKey(form.id)
    if (isDraftNonEmpty(form)) {
      saveDraft(key, form)
    } else {
      localStorage.removeItem(key)
    }
  }, [form])

  const templateFieldsToBookingFields = (
    tpl: BookingTemplate,
    groupName: string,
  ): BookingField[] => {
    const normalized = normalizeBookingGroupName(groupName)
    const booking_group_id = groupIdByName.get(normalized) ?? null
    const baseOrder = form.fields.length
    return tpl.fields.map((f, idx) => ({
      label: f.label,
      group_name: normalized,
      booking_group_id,
      field_type: f.field_type,
      is_required: f.is_required,
      options: f.options.map((o) => ({
        label: o.label,
        price: o.price,
        sort_order: o.sort_order,
      })),
      price: f.price,
      requiredDownpayment: null,
      sort_order: baseOrder + idx,
      saved: true,
      value: '',
    }))
  }

  const handleReset = () => {
    const key = draftKey(form.id)
    localStorage.removeItem(key)
    setRestoredDraft(false)
    onChange(JSON.parse(originalFormJson.current) as BookingFormState)
  }

  const addFieldToGroup = (groupName: string) => {
    const normalized = normalizeBookingGroupName(groupName)
    const booking_group_id = groupIdByName.get(normalized) ?? null
    onChange({
      ...form,
      fields: [
        ...form.fields,
        {
          ...EMPTY_FIELD,
          group_name: normalized,
          booking_group_id,
          sort_order: form.fields.length,
        },
      ],
    })
  }

  const removeGroupFromForm = (normalized: string) => {
    const nextFields = form.fields.filter(
      (f) => normalizeBookingGroupName(f.group_name) !== normalized,
    )
    const nextExtra = extraGroupNames.filter(
      (n) => normalizeBookingGroupName(n) !== normalized,
    )
    setExtraGroupNames(nextExtra)
    onChange({ ...form, fields: nextFields, extraGroupNames: nextExtra })
  }

  const deleteFieldGroup = async (groupName: string) => {
    const normalized = normalizeBookingGroupName(groupName)
    const result = await Swal.fire({
      title: `Delete "${groupName}"?`,
      text: 'This will permanently delete the group and all fields in it.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#d65a5a',
    })
    if (!result.isConfirmed) return

    const groupId = groupIdByName.get(normalized)
    if (form.mode === 'edit' && form.id != null && groupId != null && onDeleteGroup) {
      try {
        await onDeleteGroup(form.id, groupId)
      } catch {
        await Swal.fire('Error', 'Failed to delete group.', 'error')
        return
      }
    }
    removeGroupFromForm(normalized)
  }

  const toggleFieldGroup = (groupName: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  const openAddGroupModal = () => {
    setGroupNameInput('')
    setGroupNameError(null)
    setAddGroupTemplateId(null)
    setGroupNameModal({ type: 'add' })
  }

  const openEditGroupModal = (originalName: string) => {
    setGroupNameInput(originalName)
    setGroupNameError(null)
    setAddGroupTemplateId(null)
    setGroupNameModal({ type: 'edit', originalName })
  }

  const closeGroupNameModal = () => {
    setGroupNameModal(null)
    setGroupNameInput('')
    setGroupNameError(null)
    setAddGroupTemplateId(null)
  }

  const dedupeGroupNames = (names: string[]): string[] => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const raw of names) {
      const norm = normalizeBookingGroupName(raw)
      if (seen.has(norm)) continue
      seen.add(norm)
      result.push(norm)
    }
    return result
  }

  const renameBookingGroup = (oldName: string, newName: string) => {
    const oldNorm = normalizeBookingGroupName(oldName)
    const newNorm = normalizeBookingGroupName(newName)
    if (oldNorm === newNorm) return

    const nextFields = form.fields.map((f) =>
      normalizeBookingGroupName(f.group_name) === oldNorm
        ? { ...f, group_name: newNorm }
        : f,
    )
    const nextExtra = dedupeGroupNames(
      extraGroupNames.map((n) =>
        normalizeBookingGroupName(n) === oldNorm ? newNorm : n,
      ),
    )
    setDismissedApiGroupNames((prev) => {
      const next = new Set(prev.map(normalizeBookingGroupName))
      next.add(oldNorm)
      next.delete(newNorm)
      return [...next]
    })
    setExtraGroupNames(nextExtra)
    onChange({ ...form, fields: nextFields, extraGroupNames: nextExtra })
  }

  const handleGroupNameSave = () => {
    const name = normalizeBookingGroupName(groupNameInput)
    if (!groupNameInput.trim()) {
      setGroupNameError(`Enter a ${groupLabel} name.`)
      return
    }

    if (groupNameModal?.type === 'add') {
      if (fieldGroups.some((g) => g.groupName === name)) {
        setGroupNameError(`A ${groupLabel} group with that name already exists.`)
        return
      }
      const nextExtra = [...extraGroupNames, name]
      setExtraGroupNames(nextExtra)
      let nextFields = form.fields
      if (addGroupTemplateId != null) {
        const tpl = templates.find((t) => t.id === addGroupTemplateId)
        if (tpl && tpl.fields.length > 0) {
          nextFields = [...form.fields, ...templateFieldsToBookingFields(tpl, name)]
        }
      }
      onChange({ ...form, fields: nextFields, extraGroupNames: nextExtra })
      closeGroupNameModal()
      return
    }

    if (groupNameModal?.type === 'edit') {
      const oldNorm = normalizeBookingGroupName(groupNameModal.originalName)
      if (
        name !== oldNorm &&
        fieldGroups.some((g) => g.groupName === name)
      ) {
        setGroupNameError(`A ${groupLabel} group with that name already exists.`)
        return
      }
      renameBookingGroup(groupNameModal.originalName, name)
      closeGroupNameModal()
    }
  }

  const updateField = (idx: number, patch: Partial<BookingField>) => {
    onChange({
      ...form,
      fields: form.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    })
  }

  const removeField = (idx: number) => {
    onChange({
      ...form,
      fields: form.fields.filter((_, i) => i !== idx),
    })
  }

  const addOption = (fieldIdx: number) => {
    updateField(fieldIdx, {
      options: [
        ...form.fields[fieldIdx].options,
        { ...EMPTY_OPTION, sort_order: form.fields[fieldIdx].options.length },
      ],
    })
  }

  const updateOption = (
    fieldIdx: number,
    optIdx: number,
    patch: Partial<BookingField['options'][number]>,
  ) => {
    const updated = form.fields[fieldIdx].options.map((o, i) =>
      i === optIdx ? { ...o, ...patch } : o,
    )
    updateField(fieldIdx, { options: updated })
  }

  const removeOption = (fieldIdx: number, optIdx: number) => {
    updateField(fieldIdx, {
      options: form.fields[fieldIdx].options.filter((_, i) => i !== optIdx),
    })
  }

  const handleFieldDragStart = (e: DragEvent<HTMLElement>, idx: number) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', String(idx)) } catch { /* noop */ }
  }

  const handleFieldDragOver = (e: DragEvent<HTMLElement>, idx: number) => {
    if (dragIdx === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (fieldDragOver !== idx) setFieldDragOver(idx)
  }

  const handleFieldDrop = (e: DragEvent<HTMLElement>, targetIdx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null)
      setFieldDragOver(null)
      return
    }
    const next = [...form.fields]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(targetIdx, 0, moved)
    onChange({ ...form, fields: next })
    setDragIdx(null)
    setFieldDragOver(null)
  }

  const handleFieldDragEnd = () => {
    setDragIdx(null)
    setFieldDragOver(null)
  }

  const saveField = (idx: number) => {
    const field = form.fields[idx]
    if (!field.label.trim()) {
      showErrorToast('Enter a field label before saving.')
      return
    }
    if (
      field.field_type === 'select' &&
      field.options.filter((o) => o.label.trim()).length < 1
    ) {
      showErrorToast('Add at least one option for dropdown fields.')
      return
    }
    const downpaymentError =
      field.field_type === 'supplier'
        ? validateBookingSupplierFieldDownpayment(field)
        : validateBookingFieldDownpayment(field)
    if (downpaymentError) {
      showErrorToast(downpaymentError)
      return
    }
    updateField(idx, { saved: true })
  }

  const editField = (idx: number) => {
    updateField(idx, { saved: false })
  }

  const renderUnsavedFieldCard = (idx: number) => {
    const field = form.fields[idx]
    return (
      <div
        key={idx}
        className={`card card-body p-3 mb-2${fieldDragOver === idx ? ' border-primary' : ''}`}
        draggable={!viewOnly}
        onDragStart={(e) => handleFieldDragStart(e, idx)}
        onDragOver={(e) => handleFieldDragOver(e, idx)}
        onDrop={(e) => handleFieldDrop(e, idx)}
        onDragEnd={handleFieldDragEnd}
      >
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="d-flex align-items-center gap-2">
            <i
              className="bi bi-grip-vertical text-muted"
              style={{ cursor: 'grab', fontSize: '1.1rem' }}
              title="Drag to reorder"
            />
            <span className="badge bg-light text-dark">#{idx + 1}</span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            title="Remove field"
            onClick={() => removeField(idx)}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="row g-2">
          <div className="col-sm-4">
            <label className="form-label">Label *</label>
            <input
              className="form-control form-control-sm"
              placeholder="Field label"
              value={field.label}
              onChange={(e) => updateField(idx, { label: e.target.value })}
            />
          </div>
          <div className="col-sm-3">
            <label className="form-label">Type</label>
            <select
              className="form-select form-select-sm"
              value={field.field_type}
              onChange={(e) => {
                const field_type = e.target.value as FieldType
                if (field_type === 'supplier') {
                  updateField(idx, {
                    field_type,
                    price: null,
                    requiredDownpayment: null,
                    value: '',
                    options: [],
                  })
                  return
                }
                if (field_type === 'select') {
                  updateField(idx, {
                    field_type,
                    price: null,
                    value: '',
                    options:
                      field.options.length > 0
                        ? field.options
                        : [{ ...EMPTY_OPTION }],
                  })
                  return
                }
                updateField(idx, { field_type })
              }}
            >
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {field.field_type === 'select' && (
            <div className="col-sm-3">
              <label className="form-label">Downpayment</label>
              <input
                type="number"
                className="form-control form-control-sm"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={field.requiredDownpayment ?? ''}
                onChange={(e) =>
                  updateField(idx, {
                    requiredDownpayment:
                      e.target.value === '' ? null : e.target.value,
                  })
                }
              />
            </div>
          )}
          {field.field_type !== 'select' && field.field_type !== 'supplier' && (
            <>
              <div className="col-sm-2">
                <label className="form-label">Price</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={field.price ?? ''}
                  onChange={(e) =>
                    updateField(idx, {
                      price: e.target.value === '' ? null : e.target.value,
                    })
                  }
                />
              </div>
              <div className="col-sm-2">
                <label className="form-label">Downpayment</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={field.requiredDownpayment ?? ''}
                  onChange={(e) =>
                    updateField(idx, {
                      requiredDownpayment:
                        e.target.value === '' ? null : e.target.value,
                    })
                  }
                />
              </div>
            </>
          )}
          <div
            className={`${
              field.field_type === 'supplier'
                ? 'col-sm-5'
                : field.field_type === 'select'
                  ? 'col-sm-2'
                  : 'col-sm-2'
            } d-flex align-items-end`}
          >
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id={`booking-req-${idx}`}
                checked={field.is_required}
                onChange={(e) =>
                  updateField(idx, { is_required: e.target.checked })
                }
              />
              <label className="form-check-label" htmlFor={`booking-req-${idx}`}>
                Required
              </label>
            </div>
          </div>
        </div>

        {field.field_type === 'select' && (
          <div className="mt-2">
            <div className="d-flex align-items-center gap-2 mb-1">
              <small className="text-muted fw-semibold">Options</small>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary py-0 px-1"
                onClick={() => addOption(idx)}
              >
                <i className="bi bi-plus" />
              </button>
            </div>
            {field.options.length === 0 && (
              <div className="text-muted small">No options added.</div>
            )}
            {field.options.map((opt, optIdx) => (
              <div key={optIdx} className="row g-1 mb-1 align-items-center">
                <div className="col">
                  <input
                    className="form-control form-control-sm"
                    placeholder={`Option ${optIdx + 1}`}
                    value={opt.label}
                    onChange={(e) =>
                      updateOption(idx, optIdx, { label: e.target.value })
                    }
                  />
                </div>
                <div className="col-auto" style={{ width: '110px' }}>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="Price"
                    step="0.01"
                    min="0"
                    value={opt.price ?? ''}
                    onChange={(e) =>
                      updateOption(idx, optIdx, {
                        price: e.target.value === '' ? null : e.target.value,
                      })
                    }
                  />
                </div>
                <div className="col-auto">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    title="Remove"
                    onClick={() => removeOption(idx, optIdx)}
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 text-end">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => saveField(idx)}
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  const renderSavedField = (field: BookingField, idx: number) => {
    const requiredMark = field.is_required ? ' *' : ''
    const fieldLabel = `${field.label}${requiredMark}`
    const displayPrice = getSavedFieldDisplayPrice(field)
    const displayDownpayment = getSavedFieldDisplayDownpayment(field)

    return (
      <div key={idx} className="mb-3 booking-saved-field">
        <div className="booking-field-header">
          <label className="form-label mb-0 booking-field-header__label">
            {fieldLabel}
          </label>
          <div className="booking-field-header__end">
            {displayDownpayment && (
              <span className="booking-field-downpayment text-muted small">
                Down {displayDownpayment}
              </span>
            )}
            {displayPrice && (
              <span className="booking-field-price">{displayPrice}</span>
            )}
            {!viewOnly && (
              <div className="d-flex gap-1">
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0"
                  title="Edit field"
                  onClick={() => editField(idx)}
                >
                  <i className="bi bi-pencil-square" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0 text-danger"
                  title="Remove field"
                  onClick={() => removeField(idx)}
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            )}
          </div>
        </div>
        {field.field_type === 'text' && (
          <input
            type="text"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === 'textarea' && (
          <textarea
            className="form-control"
            rows={2}
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === 'number' && (
          <input
            type="number"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === 'date' && (
          <input
            type="date"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === 'time' && (
          <input
            type="time"
            className="form-control"
            step={60}
            value={storedValueToTimeInput(field.value)}
            onChange={(e) =>
              updateField(idx, { value: timeInputToStored(e.target.value) })
            }
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === 'email' && (
          <input
            type="email"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === 'phone' && (
          <input
            type="tel"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          />
        )}
        {field.field_type === 'checkbox' && (
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id={`booking-field-${idx}`}
              checked={field.value === 'true'}
              onChange={(e) => updateField(idx, { value: e.target.checked ? 'true' : '' })}
              required={field.is_required && field.value !== 'true'}
              {...readOnlyFieldProps}
            />
            <label className="form-check-label" htmlFor={`booking-field-${idx}`}>
              {field.label}
            </label>
          </div>
        )}
        {field.field_type === 'select' && (
          <select
            className="form-select"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
            {...readOnlyFieldProps}
          >
            <option value="">Select...</option>
            {field.options.filter((o) => o.label.trim()).map((opt, oi) => {
              const optionPrice = formatFieldPriceAmount(opt.price)
              return (
                <option key={oi} value={opt.label}>
                  {opt.label}
                  {optionPrice ? ` — ${optionPrice}` : ''}
                </option>
              )
            })}
          </select>
        )}
        {field.field_type === 'supplier' && (
          <SupplierFieldInput
            value={field.value}
            dateOfEvent={form.dateOfEvent}
            excludeBookingId={form.mode === 'edit' ? form.id : null}
            onChange={(value, price, packageRequiredDownpayment) =>
              updateField(idx, {
                value,
                price: price ?? null,
                packageRequiredDownpayment: packageRequiredDownpayment ?? null,
              })
            }
            required={field.is_required}
          />
        )}
      </div>
    )
  }

  return (
    <>
      <div
        className="booking-edit-modal-backdrop modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="booking-edit-modal modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookingEditTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <form
              onSubmit={(e) => {
                if (viewOnly) {
                  e.preventDefault()
                  return
                }
                void onSubmit(e)
              }}
              noValidate
            >
              <div className="modal-header">
                <div className="me-auto">
                  <h1 id="bookingEditTitle" className="modal-title fs-5 mb-0">
                    {form.mode === 'create'
                      ? 'New booking'
                      : viewOnly
                        ? 'View booking'
                        : 'Edit booking'}
                  </h1>
                  {form.mode === 'edit' && form.id != null && (
                    <p className="booking-edit-modal__booking-id text-muted small mb-0 mt-1">
                      Booking ID:{' '}
                      <span className="text-body">
                        {(form.uniqueId ?? '').trim() || `#${form.id}`}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                />
              </div>
              <div className="modal-body">
                {viewOnly && modalTab === 'details' && (
                  <div className="alert alert-info py-2 small mb-3" role="status">
                    This booking belongs to{' '}
                    <span className="fw-semibold">
                      {(form.companyName ?? '').trim() || 'another company'}
                    </span>
                    . You can view details and download the PDF only.
                  </div>
                )}
                {showHistoryTab && (
                  <ul className="nav nav-tabs booking-edit-modal-tabs mb-3" role="tablist">
                    <li className="nav-item" role="presentation">
                      <button
                        type="button"
                        role="tab"
                        className={`nav-link${modalTab === 'details' ? ' active' : ''}`}
                        aria-selected={modalTab === 'details'}
                        onClick={() => setModalTab('details')}
                      >
                        Details
                      </button>
                    </li>
                    <li className="nav-item" role="presentation">
                      <button
                        type="button"
                        role="tab"
                        className={`nav-link${modalTab === 'history' ? ' active' : ''}`}
                        aria-selected={modalTab === 'history'}
                        onClick={() => setModalTab('history')}
                      >
                        History
                      </button>
                    </li>
                  </ul>
                )}
                {modalTab === 'history' && showHistoryTab && form.id != null ? (
                  <BookingHistoryPanel
                    bookingId={form.id}
                    refreshKey={historyRefreshKey}
                  />
                ) : (
                <fieldset
                  className={`booking-edit-modal__fieldset${
                    viewOnly ? ' is-view-only' : ''
                  }`}
                >
                {restoredDraft && !viewOnly && (
                  <div className="alert alert-info py-2 mb-3 d-flex align-items-center" role="status">
                    <i className="bi bi-save me-2" />
                    <span className="flex-grow-1">
                      Your previous draft has been restored. Click Reset to discard it and start fresh.
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning ms-2"
                      onClick={handleReset}
                    >
                      <i className="bi bi-arrow-counterclockwise me-1" />
                      Reset
                    </button>
                  </div>
                )}
                <div className="row align-items-stretch">
                  <div className="col-md-9">
                    <div className="mb-3">
                      <label htmlFor="booking-title" className="form-label">
                        Title
                      </label>
                      <input
                        id="booking-title"
                        type="text"
                        className="form-control"
                        value={form.title}
                        onChange={(e) =>
                          onChange({ ...form, title: e.target.value })
                        }
                        required
                        autoFocus
                        {...readOnlyFieldProps}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Date of Booking</label>
                      <div className="d-flex gap-2">
                        <input
                          id="booking-date"
                          type="date"
                          className="form-control"
                          value={form.dateOfEvent}
                          onChange={(e) =>
                            onChange({ ...form, dateOfEvent: e.target.value })
                          }
                          {...readOnlyFieldProps}
                        />
                        <input
                          id="booking-time"
                          type="time"
                          className="form-control"
                          value={form.timeOfEvent}
                          onChange={(e) =>
                            onChange({ ...form, timeOfEvent: e.target.value })
                          }
                          {...readOnlyFieldProps}
                        />
                      </div>
                    </div>
                    <div className="mb-3 booking-fields-groups">
                      {!viewOnly && (
                        <div className="booking-fields-groups-toolbar">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={openAddGroupModal}
                          >
                            + Add {groupLabel}
                          </button>
                        </div>
                      )}
                      <ul className="faq-list booking-fields-group-list">
                        {fieldGroups.map((group) => {
                          const isOpen = openGroups[group.groupName] ?? false
                          const subtotal = groupSubtotals.get(group.groupName) ?? 0
                          return (
                            <li
                              key={group.groupName}
                              className={`faq-item${isOpen ? ' is-open' : ''}`}
                            >
                              <div className="booking-fields-group-head">
                                <button
                                  type="button"
                                  className="faq-toggle booking-fields-group-toggle"
                                  aria-expanded={isOpen}
                                  onClick={() => toggleFieldGroup(group.groupName)}
                                >
                                  <span className="faq-icon" aria-hidden="true">
                                    <i className="bi bi-collection" />
                                  </span>
                                  <span className="faq-question-row">
                                    <span className="faq-question">{group.groupName}</span>
                                    <span className="booking-fields-group-subtotal">
                                      {formatCurrency(subtotal, currencyOptions)}
                                    </span>
                                  </span>
                                  <span className="faq-chevron" aria-hidden="true">
                                    <i className="bi bi-chevron-down" />
                                  </span>
                                </button>
                                {!viewOnly && (
                                  <button
                                    type="button"
                                    className="booking-fields-group-edit btn btn-link"
                                    aria-label={`Rename ${group.groupName}`}
                                    title={`Rename ${group.groupName}`}
                                    onClick={() => openEditGroupModal(group.groupName)}
                                  >
                                    <i className="bi bi-pencil-square" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                              {isOpen && (
                                <div className="faq-answer faq-answer--form">
                                  {group.items.map(({ field, idx }) =>
                                    field.saved ? (
                                      renderSavedField(field, idx)
                                    ) : (
                                      renderUnsavedFieldCard(idx)
                                    ),
                                  )}
                                  {group.items.length === 0 && (
                                    <p className="text-muted small mb-0">
                                      No fields in this group yet.
                                    </p>
                                  )}
                                  {!viewOnly && (
                                    <div className="booking-fields-group-actions">
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => void deleteFieldGroup(group.groupName)}
                                      >
                                        Delete
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={() => addFieldToGroup(group.groupName)}
                                      >
                                        + Add Field
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    <div className="mb-0">
                      <label htmlFor="booking-notes" className="form-label">
                        Notes
                      </label>
                      <textarea
                        id="booking-notes"
                        className="form-control"
                        rows={3}
                        value={form.notes}
                        onChange={(e) =>
                          onChange({ ...form, notes: e.target.value })
                        }
                        {...readOnlyFieldProps}
                      />
                    </div>
                  </div>
                  <div className="col-md-3 d-flex flex-column booking-edit-modal-sidebar">
                    <div className="mb-3">
                      <label htmlFor="booking-status" className="form-label">
                        Status
                      </label>
                      <select
                        id="booking-status"
                        className="form-select"
                        value={form.statusId}
                        onChange={(e) =>
                          onChange({ ...form, statusId: Number(e.target.value) })
                        }
                        {...readOnlyFieldProps}
                      >
                        {statuses.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label htmlFor="booking-contact" className="form-label">
                        Contact
                      </label>
                      <div className="input-group">
                        <select
                          id="booking-contact"
                          className="form-select"
                          value={form.contactId != null ? String(form.contactId) : ''}
                          disabled={contactsLoading || viewOnly}
                          onChange={(e) => {
                            const raw = e.target.value
                            onChange({
                              ...form,
                              contactId: raw === '' ? null : Number(raw),
                            })
                          }}
                        >
                          <option value="">
                            {contactsLoading ? 'Loading contacts…' : 'Select a contact'}
                          </option>
                          {contacts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {contactDisplayName(c)}
                            </option>
                          ))}
                        </select>
                        {!viewOnly && (
                          <button
                            type="button"
                            className="btn btn-outline-primary"
                            title="Add contact"
                            aria-label="Add contact"
                            onClick={openAddContact}
                          >
                            <i className="bi bi-plus-lg" />
                          </button>
                        )}
                      </div>
                    </div>
                    {selectedContact && (
                      <div className="booking-contact-summary mb-3">
                        <div className="booking-contact-summary__heading fw-semibold mb-2">
                          Contact Details
                        </div>
                        <div className="booking-contact-summary__row">
                          <span className="booking-contact-summary__label">First name</span>
                          <span className="booking-contact-summary__value">
                            {selectedContact.first_name || '—'}
                          </span>
                        </div>
                        <div className="booking-contact-summary__row">
                          <span className="booking-contact-summary__label">Last name</span>
                          <span className="booking-contact-summary__value">
                            {selectedContact.last_name || '—'}
                          </span>
                        </div>
                        <div className="booking-contact-summary__row">
                          <span className="booking-contact-summary__label">
                            {defaultContactPhone
                              ? contactPhoneLabel(defaultContactPhone)
                              : 'Phone'}
                          </span>
                          <span className="booking-contact-summary__value">
                            {defaultContactPhone?.number?.trim() || '—'}
                          </span>
                        </div>
                        <div className="booking-contact-summary__row">
                          <span className="booking-contact-summary__label">
                            {defaultContactAddress
                              ? contactAddressLabel(defaultContactAddress)
                              : 'Address'}
                          </span>
                          <span className="booking-contact-summary__value">
                            {defaultContactAddress
                              ? formatContactAddress(defaultContactAddress) || '—'
                              : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="booking-price-summary mt-auto">
                      <h6 className="booking-price-summary__title">Price summary</h6>
                      {priceGroups.length === 0 ? (
                        <p className="booking-price-summary__empty text-muted small mb-0">
                          Selected fields with prices will appear here.
                        </p>
                      ) : (
                        <div className="booking-price-summary__groups">
                          {priceGroups.map((group) => (
                            <div
                              key={group.groupName}
                              className="booking-price-summary__group"
                            >
                              <h6 className="booking-price-summary__group-title">
                                {group.groupName}
                              </h6>
                              <ul className="booking-price-summary__list list-unstyled mb-0">
                                {group.lines.map((line, i) => (
                                  <li
                                    key={`${group.groupName}-${line.label}-${i}`}
                                    className="booking-price-summary__row"
                                  >
                                    <span className="booking-price-summary__label">
                                      {line.label}
                                    </span>
                                    <span className="booking-price-summary__amount">
                                      {formatCurrency(line.amount, currencyOptions)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              {priceGroups.length > 1 && (
                                <div className="booking-price-summary__group-total">
                                  <span>Subtotal</span>
                                  <span>
                                    {formatCurrency(group.subtotal, currencyOptions)}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="booking-price-summary__total">
                        <span>Total</span>
                        <span>{formatCurrency(priceTotal, currencyOptions)}</span>
                      </div>
                      <div className="booking-price-summary__total booking-price-summary__downpayment">
                        <span>Downpayment</span>
                        <span>
                          {formatCurrency(requiredDownpaymentTotal, currencyOptions)}
                        </span>
                      </div>
                      {showPaymentBalance && (
                        <>
                          <div className="booking-price-summary__total booking-price-summary__paid">
                            <span>Paid toward booking</span>
                            <span>{formatCurrency(paidTotal, currencyOptions)}</span>
                          </div>
                          {paidChargeTotal > 0 && (
                            <div className="booking-price-summary__detail">
                              <span>Customer paid (gross)</span>
                              <span>
                                {formatCurrency(paidChargeTotal, currencyOptions)}
                              </span>
                            </div>
                          )}
                          {paidProcessingTotal > 0 && (
                            <div className="booking-price-summary__detail">
                              <span>Processing fees</span>
                              <span>
                                {formatCurrency(paidProcessingTotal, currencyOptions)}
                              </span>
                            </div>
                          )}
                          {paidPlatformTotal > 0 && (
                            <div className="booking-price-summary__detail">
                              <span>Platform fees</span>
                              <span>
                                {formatCurrency(paidPlatformTotal, currencyOptions)}
                              </span>
                            </div>
                          )}
                          <div className="booking-price-summary__total booking-price-summary__remaining">
                            <span>Remaining</span>
                            <span>
                              {formatCurrency(remainingBalance, currencyOptions)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                </fieldset>
                )}
              </div>
              <div className="modal-footer booking-edit-modal-footer">
                <div className="booking-edit-modal-footer__end">
                {modalTab === 'history' ? (
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Close
                  </button>
                ) : viewOnly && form.mode === 'edit' ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      title="Download Quotation"
                      aria-label="Download Quotation"
                      disabled={pdfDownloading || form.id == null}
                      onClick={() => void handleDownloadBookingPdf()}
                    >
                      {pdfDownloading ? (
                        <span
                          className="spinner-border spinner-border-sm"
                          role="status"
                          aria-hidden="true"
                        />
                      ) : (
                        <>
                          <i className="bi bi-file-earmark-arrow-down me-1" aria-hidden="true" />
                          Download PDF
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {form.mode === 'edit' && (
                      <>
                        <div className="booking-edit-modal-footer__send">
                          {showPaymentsButton && (
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => setPaymentsModalOpen(true)}
                            >
                              <i className="bi bi-credit-card me-1" aria-hidden="true" />
                              Payments
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => onSendToCalendar?.()}
                            disabled={!onSendToCalendar}
                          >
                            <i className="bi bi-calendar-event me-1" aria-hidden="true" />
                            Send to Calendar
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => void openBookingEmailModal()}
                          >
                            <i className="bi bi-envelope me-1" aria-hidden="true" />
                            Send Email to Client
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            title="Download Quotation"
                            aria-label="Download Quotation"
                            disabled={pdfDownloading || form.id == null}
                            onClick={() => void handleDownloadBookingPdf()}
                          >
                            {pdfDownloading ? (
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                                aria-hidden="true"
                              />
                            ) : (
                              <i className="bi bi-file-earmark-arrow-down" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                        <div
                          className="booking-edit-modal-footer__divider"
                          role="separator"
                          aria-orientation="vertical"
                        />
                      </>
                    )}
                    <div className="booking-edit-modal-footer__actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onClose}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Save
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        data-close-after="true"
                      >
                        Save and Close
                      </button>
                    </div>
                  </>
                )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {groupNameModal && (
        <>
          <div
            className="booking-group-modal-backdrop"
            aria-hidden="true"
            onClick={closeGroupNameModal}
          />
          <div
            className="booking-group-modal modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bookingGroupNameModalTitle"
          >
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 id="bookingGroupNameModalTitle" className="modal-title fs-6">
                    {groupNameModal.type === 'add'
                      ? `Add ${groupLabel}`
                      : `Rename ${groupLabel}`}
                  </h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeGroupNameModal}
                  />
                </div>
                <div className="modal-body">
                  <label htmlFor="booking-group-name-input" className="form-label">
                    {groupLabel} name
                  </label>
                  <input
                    id="booking-group-name-input"
                    type="text"
                    className={`form-control${groupNameError ? ' is-invalid' : ''}`}
                    value={groupNameInput}
                    onChange={(e) => {
                      setGroupNameInput(e.target.value)
                      setGroupNameError(null)
                    }}
                    autoFocus
                  />
                  {groupNameError && (
                    <div className="invalid-feedback d-block">{groupNameError}</div>
                  )}
                  {groupNameModal.type === 'add' && (
                    <div className="mt-3">
                      <label htmlFor="booking-group-template" className="form-label">
                        Form Template
                      </label>
                      <select
                        id="booking-group-template"
                        className="form-select"
                        value={addGroupTemplateId ?? ''}
                        onChange={(e) =>
                          setAddGroupTemplateId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">None</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <p className="form-text small mb-0">
                        Optional. Adds template fields to this group.
                      </p>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={closeGroupNameModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleGroupNameSave}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {paymentsModalOpen && form.mode === 'edit' && form.id != null && (
        <BookingPaymentsModal
          bookingId={form.id}
          nestedModalOpen={emailModalOpen}
          bookingTotal={storedBookingTotal}
          requiredDownpayment={
            Number((form.requiredDownpaymentAmount ?? '').trim()) > 0
              ? Number(form.requiredDownpaymentAmount)
              : requiredDownpaymentTotal
          }
          contactEmail={selectedContact?.email?.trim() ?? ''}
          currencyOptions={currencyOptions}
          onClose={() => {
            setPaymentsModalOpen(false)
            if (form.id != null) {
              void fetchBookingPaymentLinks(form.id)
                .then(({ summary }) => {
                  onChange({
                    ...form,
                    paidAmount: summary.paid_amount,
                    paidChargeAmount: summary.paid_charge_amount ?? '0',
                    paidProcessingFees: summary.paid_processing_fees ?? '0',
                    paidPlatformFees: summary.paid_platform_fees ?? '0',
                  })
                })
                .catch(() => {})
            }
          }}
          onSendToCustomer={openPaymentLinkEmailModal}
        />
      )}

      {emailModalOpen && (
        <EmailSenderModal
          key={`booking-email-${form.id ?? 'new'}-${emailPaymentLinkMode ? 'payment-link' : 'general'}`}
          stacked={emailPaymentLinkMode && paymentsModalOpen}
          error={emailError}
          sending={emailSending}
          composeDefaults={
            emailPaymentLinkMode ? paymentLinkEmailDefaults : bookingEmailDefaults
          }
          draftScope={
            emailPaymentLinkMode
              ? `booking-${form.id}-payment-link`
              : `booking-${form.id ?? 'new'}`
          }
          initialBookingTemplateName={
            emailPaymentLinkMode ? 'payment_link' : undefined
          }
          paymentLinkUrl={paymentLinkUrlForEmail ?? undefined}
          bookingTemplateCompanyId={userCompanyId}
          onSend={handleBookingEmailSend}
          onClose={() => {
            setEmailModalOpen(false)
            setEmailPaymentLinkMode(false)
            setPaymentLinkUrlForEmail(null)
            setEmailError(null)
          }}
        />
      )}

      {addContactOpen && (
        <ContactFormModal
          editing={null}
          form={addContactForm}
          setField={setAddContactField}
          error={addContactError}
          saving={addContactSaving}
          onSave={() => void handleAddContactSave()}
          onClose={closeAddContact}
          elevated
        />
      )}
    </>
  )
}

export default BookingEditModal
