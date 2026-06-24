import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, SubmitEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  type BookingStatusRecord,
  type BookingItemRecord,
  createBookingStatus,
  createBookingItem,
  deleteBookingStatus,
  deleteBookingGroup,
  deleteBookingItem,
  fetchBookingStatuses,
  fetchBookingItem,
  fetchBookingItemsBoardPage,
  fetchBookingItemsPage,
  reorderBookingItems,
  updateBookingStatus,
  updateBookingItem,
} from '../services/bookings'
import BookingEditModal, { type BookingFormState, type BookingField, clearBookingDraft } from '../components/BookingEditModal'
import { finalizeBookingFieldDefinitions } from '../lib/bookingFieldSave'
import KanbanColumnStatusTags from '../components/KanbanColumnStatusTags'
import KanbanBoardLoadingPlaceholder from '../components/KanbanBoardLoadingPlaceholder'
import BookingPaymentStatusPill from '../components/BookingPaymentStatusPill'
import { bookingPaymentStatus } from '../lib/bookingPaymentStatus'
import AppointmentEditModal, {
  type AppointmentFormState,
} from '../components/AppointmentEditModal'
import { appointmentFormFromBooking } from '../lib/appointmentFromBooking'
import { appointmentPayloadFromForm } from '../lib/calendarEventFormat'
import { fetchContacts, type ContactRecord } from '../services/contacts'
import {
  createCalendarEvent,
  fetchCalendarStatuses,
  type CalendarStatusRecord,
} from '../services/calendar'
import {
  parseSupplierFieldValue,
  supplierFieldForStorage,
} from '../lib/supplierFieldValue'
import StatusEditModal, { COLOR_SWATCHES, type StatusFormState } from '../components/StatusEditModal'
import { type FormTemplateRecord, fetchFormTemplates } from '../services/formTemplates'
import { fetchBookingViewConfig } from '../services/config'
import {
  BOOKING_VIEW_DEFAULT,
  isBookingsView,
  type BookingsView,
} from '../utils/bookingsView'
import {
  buildBookingGroupsPayload,
  emptyBookingGroupNamesFromItem,
} from '../lib/bookingFieldGroups'
import { quotationCardSuppliersFromFieldValues } from '../lib/bookingCardSuppliers'
import {
  bookingPriceSummaryRequiredDownpaymentAmount,
  validateBookingFieldDownpayment,
  validateBookingSupplierFieldDownpayment,
} from '../lib/bookingPriceSummary'
import {
  quotationPricingAdjustmentFromApiItem,
  quotationPricingAdjustmentFromForm,
  quotationPricingPayloadFromForm,
  type QuotationPricingAdjustment,
} from '../lib/quotationPricingAdjustments'
import { normalizeContactId } from '../lib/contactDisplay'
import {
  currencyFormatFromAccount,
  formatCurrency,
  type CurrencyFormatOptions,
} from '../utils/currency'
import { fetchCurrentAccount } from '../services/accounts'
import { useFeatureAccess } from '../hooks/useFeatureAccess'
import { showErrorToast, showSuccessToast } from '../utils/toast'

type BookingColumn = BookingStatusRecord
type BookingItem = BookingItemRecord

function fieldValuesToFields(item: BookingItem): BookingField[] {
  return (item.field_values ?? []).map((fv) => {
    const fieldType = fv.field_type as BookingField['field_type']
    const stored =
      fieldType === 'supplier'
        ? supplierFieldForStorage(fv.value, fv.price)
        : { value: fv.value, price: fv.price }
    return {
      label: fv.label,
      group_name: fv.group_name ?? 'Suppliers',
      quotation_group_id: fv.quotation_group_id ?? null,
      field_type: fieldType,
      is_required: fv.is_required,
      options: (fv.options ?? []).map((o) => ({
        label: o.label,
        price: o.price,
        sort_order: o.sort_order,
      })),
      price: stored.price,
      requiredDownpayment:
        fieldType === 'supplier' ? null : (fv.required_downpayment ?? null),
      sort_order: fv.sort_order,
      saved: true,
      value: stored.value,
      supplier_type_id: fv.supplier_type ?? null,
      packageRequiredDownpayment:
        fieldType === 'supplier'
          ? (fv.package_required_downpayment_amount ?? null)
          : null,
    }
  })
}

function fieldsToFieldValues(fields: BookingField[]) {
  return fields
    .filter((f) => f.saved)
    .map((f, idx) => {
      const stored =
        f.field_type === 'supplier'
          ? supplierFieldForStorage(f.value, f.price)
          : { value: f.value, price: f.price }
      return {
        label: f.label,
        group_name: f.group_name ?? 'Suppliers',
        field_type: f.field_type,
        is_required: f.is_required,
        price: stored.price,
        required_downpayment:
          f.field_type === 'supplier' ? null : f.requiredDownpayment ?? null,
        value: stored.value,
        supplier_type:
          f.field_type === 'supplier' ? (f.supplier_type_id ?? null) : null,
        options: f.options.map((o, oi) => ({
          label: o.label,
          price: o.price,
          sort_order: oi,
        })),
        sort_order: idx,
      }
    })
}

type DragState = {
  itemId: number
  sourceColumnId: number
  targetColumnId: number
  targetIndex: number
}

const EDIT_PARAM = 'edit'


// --- Helpers for the Cards view (deterministic synthesised details) -------

const CARD_ICONS = [
  'bi-grid-1x2-fill',
  'bi-bezier2',
  'bi-vector-pen',
  'bi-palette-fill',
  'bi-kanban',
  'bi-clipboard-data',
  'bi-window-stack',
  'bi-easel2',
  'bi-bounding-box',
  'bi-stars',
] as const

function stableHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatBookingId(item: BookingItem): string {
  const uniqueId = (item.unique_id ?? '').trim()
  return uniqueId || `#${item.id}`
}

function formatBookingEventDate(item: BookingItem): string {
  if (!item.date_of_event) return '—'
  const d = new Date(item.date_of_event)
  const datePart = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    return datePart
  }
  const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
  return `${datePart} · ${timePart}`
}

function formatBookingCardDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const datePart = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    return datePart
  }
  const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
  return `${datePart} · ${timePart}`
}

function formatBookingCardTotalAmount(
  item: BookingItem,
  currencyFormat: CurrencyFormatOptions,
): string {
  const raw = (item.total_amount ?? '').trim()
  if (!raw) return '—'
  const amount = Number(raw)
  if (Number.isNaN(amount)) return raw
  return formatCurrency(amount, currencyFormat)
}

function bookingCardIconClass(item: BookingItem): string {
  const h = stableHash(String(item.id))
  return CARD_ICONS[h % CARD_ICONS.length]
}

function hexToRgba(hex: string, alpha: number): string {
  let v = hex.replace('#', '')
  if (v.length === 3) {
    v = v
      .split('')
      .map((c) => c + c)
      .join('')
  }
  const r = parseInt(v.substring(0, 2), 16) || 0
  const g = parseInt(v.substring(2, 4), 16) || 0
  const b = parseInt(v.substring(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function computeDropIndex(
  e: DragEvent<HTMLElement>,
  listEl: HTMLElement,
): number {
  const cards = Array.from(
    listEl.querySelectorAll<HTMLElement>('[data-card-id]'),
  )
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect()
    if (e.clientY < rect.top + rect.height / 2) {
      return i
    }
  }
  return cards.length
}

function bookingCanEdit(item: BookingItem): boolean {
  return item.can_edit === true
}

function canMutateBookingItem(item: BookingItem, hasWriteAccess: boolean): boolean {
  return hasWriteAccess && bookingCanEdit(item)
}

function BookingOwnerCompanyLabel({
  item,
  className = '',
}: {
  item: BookingItem
  className?: string
}) {
  if (bookingCanEdit(item)) {
    return null
  }
  const name = item.company_name?.trim()
  if (!name) {
    return null
  }
  return (
    <p className={`booking-owner-company mb-0${className ? ` ${className}` : ''}`}>
      <span className="booking-owner-company__label">Created by:</span>{' '}
      <span className="booking-owner-company__name">{name}</span>
    </p>
  )
}

/** Booking status id exists on this account's board columns. */
function bookingHasLocalStatusColumn(
  item: BookingItem,
  columns: BookingColumn[],
): boolean {
  return columns.some((c) => c.id === item.status)
}

/** Map booking status to a local column (cross-account suppliers use title). */
function bookingColumnIdForItem(
  item: BookingItem,
  columns: BookingColumn[],
): number | null {
  if (bookingHasLocalStatusColumn(item, columns)) {
    return item.status
  }
  const title = (item.status_title ?? '').trim().toLowerCase()
  if (!title) {
    return null
  }
  const match = columns.find((c) => c.title.trim().toLowerCase() === title)
  return match?.id ?? null
}

/** Tenant booking shown on this account's board (view-only supplier). */
function bookingIsFromOtherCompany(item: BookingItem): boolean {
  return !bookingCanEdit(item)
}

/** Status id is from the owner's account, not this board's columns. */
function bookingUsesForeignStatus(
  item: BookingItem,
  columns: BookingColumn[],
): boolean {
  return bookingIsFromOtherCompany(item) && !bookingHasLocalStatusColumn(item, columns)
}

function bookingForeignStatusTitle(item: BookingItem): string {
  return (item.status_title ?? '').trim() || 'Unknown status'
}

const FOREIGN_UNMATCHED_COLUMN_TITLE = 'Other statuses'

type BoardColumnLoadState = {
  items: BookingItem[]
  total: number
  page: number
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
}

const EMPTY_BOARD_COLUMN: BoardColumnLoadState = {
  items: [],
  total: 0,
  page: 0,
  hasMore: false,
  loading: false,
  loadingMore: false,
}

const FOREIGN_BOARD_KEY = -1

function findBoardColumnKeyForItem(
  itemId: number,
  boardColumns: Record<number, BoardColumnLoadState>,
  foreignBoard: BoardColumnLoadState,
  columns: BookingColumn[],
): number | typeof FOREIGN_BOARD_KEY | null {
  for (const col of columns) {
    const state = boardColumns[col.id]
    if (state?.items.some((it) => it.id === itemId)) {
      return col.id
    }
  }
  if (foreignBoard.items.some((it) => it.id === itemId)) {
    return FOREIGN_BOARD_KEY
  }
  return null
}

function BookingForeignStatusNote({
  item,
  className = '',
}: {
  item: BookingItem
  className?: string
}) {
  return (
    <div
      className={`booking-foreign-status${className ? ` ${className}` : ''}`}
    >
      <span className="booking-foreign-status__title">
        {bookingForeignStatusTitle(item)}
      </span>
      <span className="booking-foreign-status__note">
        Status from another company
      </span>
    </div>
  )
}

function bookingCardColumnForItem(
  item: BookingItem,
  columns: BookingColumn[],
): BookingColumn | undefined {
  const columnId = bookingColumnIdForItem(item, columns)
  return columnId != null ? columns.find((c) => c.id === columnId) : undefined
}

function bookingItemNeedsFullFetch(item: BookingItem): boolean {
  return !Array.isArray(item.field_values)
}

function bookingItemStub(id: number, fallbackStatusId: number): BookingItem {
  return {
    id,
    unique_id: '',
    status: fallbackStatusId,
    contact: null,
    title: '',
    date_of_event: null,
    total_amount: '',
    required_downpayment_amount: '',
    notes: '',
    sort_order: 0,
    created_by: null,
    pdf_url: '',
    created_at: '',
    updated_at: '',
    company: 0,
    can_edit: true,
  }
}

function isItemModalHydrated(
  modal: BookingFormState | null,
  quotationId: number,
  loading: boolean,
): boolean {
  if (loading || !modal || modal.mode !== 'edit' || modal.id !== quotationId) {
    return false
  }
  return Boolean(
    modal.title.trim() ||
      modal.fields.length > 0 ||
      modal.notes.trim() ||
      modal.dateOfEvent.trim(),
  )
}

function bookingItemToEditForm(item: BookingItem): BookingFormState {
  let dateOfEvent = ''
  let timeOfEvent = ''
  if (item.date_of_event) {
    const d = new Date(item.date_of_event)
    dateOfEvent = formatYmd(d)
    timeOfEvent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const fields = fieldValuesToFields(item)
  const extraGroupNames = emptyBookingGroupNamesFromItem(
    item.field_values ?? [],
    item.groups ?? [],
  )
  const pricingAdjustment = quotationPricingAdjustmentFromApiItem(item)
  return {
    mode: 'edit',
    id: item.id,
    uniqueId: item.unique_id ?? '',
    statusId: item.status,
    contactId: normalizeContactId(item.contact),
    title: item.title,
    dateOfEvent,
    timeOfEvent,
    fields,
    extraGroupNames,
    notes: item.notes,
    pdfUrl: item.pdf_url ?? '',
    totalAmount: item.total_amount ?? '',
    discountAmount: pricingAdjustment.discountAmount,
    discountType: pricingAdjustment.discountType,
    overrideTotalAmount: pricingAdjustment.overrideTotalAmount,
    requiredDownpaymentAmount: item.required_downpayment_amount ?? '',
    paidAmount: item.paid_amount ?? '0',
    paidChargeAmount: item.paid_charge_amount ?? '0',
    paidProcessingFees: item.paid_processing_fees ?? '0',
    paidPlatformFees: item.paid_platform_fees ?? '0',
    refundedAmount: item.refunded_amount ?? '0',
    canEdit: item.can_edit === true,
    companyName: item.company_name ?? '',
  }
}

const BookingsPage = () => {
  const { canRead: bookingsRead, canWrite: bookingsWrite } = useFeatureAccess('quotations')
  const { canWrite: statusesWrite } = useFeatureAccess('quotation_settings_statuses')
  const canMutate = (item: BookingItem) => canMutateBookingItem(item, bookingsWrite)
  const [columns, setColumns] = useState<BookingColumn[]>([])
  const [boardColumns, setBoardColumns] = useState<
    Record<number, BoardColumnLoadState>
  >({})
  const [foreignBoard, setForeignBoard] =
    useState<BoardColumnLoadState>(EMPTY_BOARD_COLUMN)
  const [boardSearch, setBoardSearch] =
    useState<BoardColumnLoadState>(EMPTY_BOARD_COLUMN)
  const [templates, setTemplates] = useState<FormTemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<BookingsView>(BOOKING_VIEW_DEFAULT)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [statusModal, setStatusModal] = useState<StatusFormState | null>(null)
  const [itemModal, setItemModal] = useState<BookingFormState | null>(null)
  const [itemModalLoading, setItemModalLoading] = useState(false)
  const [modalBookingGroups, setModalBookingGroups] = useState<
    BookingItem['groups']
  >([])
  const [bookingHistoryRefresh, setBookingHistoryRefresh] = useState(0)
  const [appointmentModal, setAppointmentModal] = useState<AppointmentFormState | null>(null)
  const [appointmentContacts, setAppointmentContacts] = useState<ContactRecord[]>([])
  const [appointmentStatuses, setAppointmentStatuses] = useState<CalendarStatusRecord[]>([])
  const [appointmentLoadingOptions, setAppointmentLoadingOptions] = useState(false)
  const [appointmentSaving, setAppointmentSaving] = useState(false)
  const [itemSaving, setItemSaving] = useState(false)
  const [appointmentModalError, setAppointmentModalError] = useState<string | null>(null)
  const suppressEditFromUrl = useRef(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const isSearching = search.trim().length > 0
  const [listItems, setListItems] = useState<BookingItem[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [listPage, setListPage] = useState(0)
  const [listHasMore, setListHasMore] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [listLoadingMore, setListLoadingMore] = useState(false)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const listSentinelRef = useRef<HTMLTableRowElement>(null)
  const listLoadingMoreRef = useRef(false)
  const [cardsItems, setCardsItems] = useState<BookingItem[]>([])
  const [cardsTotal, setCardsTotal] = useState(0)
  const [cardsPage, setCardsPage] = useState(0)
  const [cardsHasMore, setCardsHasMore] = useState(false)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [cardsLoadingMore, setCardsLoadingMore] = useState(false)
  const cardsScrollRef = useRef<HTMLDivElement>(null)
  const cardsSentinelRef = useRef<HTMLDivElement>(null)
  const cardsLoadingMoreRef = useRef(false)
  const boardColumnLoadingMoreRef = useRef<Record<number, boolean>>({})
  const foreignBoardLoadingMoreRef = useRef(false)
  const boardSearchLoadingMoreRef = useRef(false)
  const columnSentinelRefs = useRef<Map<number, HTMLDivElement | null>>(new Map())
  const foreignSentinelRef = useRef<HTMLDivElement | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [currencyFormat, setCurrencyFormat] = useState<CurrencyFormatOptions>({
    currencyCode: 'USD',
    currencySymbol: '$',
    locale: 'en-US',
  })

  // --- Data loading --------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    fetchBookingViewConfig()
      .then((data) => {
        if (cancelled) return
        if (isBookingsView(data.value)) setActiveView(data.value)
      })
      .catch(() => {
        /* keep default view */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const view = searchParams.get('view')
    if (isBookingsView(view)) setActiveView(view)
  }, [searchParams])

  const loadData = useCallback(async () => {
    try {
      const [cols, tmpls, account] = await Promise.all([
        fetchBookingStatuses(),
        fetchFormTemplates(),
        fetchCurrentAccount().catch(() => null),
      ])
      setColumns(cols)
      setTemplates(tmpls)
      if (account) {
        setCurrencyFormat(currencyFormatFromAccount(account))
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [search])

  const loadListPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) {
        setListLoading(true)
      } else {
        if (listLoadingMoreRef.current) return
        listLoadingMoreRef.current = true
        setListLoadingMore(true)
      }
      try {
        const data = await fetchBookingItemsPage(pageNum, {
          search: debouncedSearch,
        })
        setListTotal(data.count)
        setListHasMore(data.next !== null)
        setListPage(pageNum)
        setListItems((prev) =>
          replace ? data.results : [...prev, ...data.results],
        )
      } catch {
        if (replace) {
          setListItems([])
          setListTotal(0)
          setListHasMore(false)
          setListPage(0)
        }
      } finally {
        if (replace) {
          setListLoading(false)
        } else {
          listLoadingMoreRef.current = false
          setListLoadingMore(false)
        }
      }
    },
    [debouncedSearch],
  )

  const reloadListBookings = useCallback(() => {
    void loadListPage(1, true)
  }, [loadListPage])

  const loadBoardColumnPage = useCallback(
    async (columnId: number, pageNum: number, replace: boolean) => {
      if (replace) {
        setBoardColumns((prev) => ({
          ...prev,
          [columnId]: {
            ...(prev[columnId] ?? EMPTY_BOARD_COLUMN),
            loading: true,
          },
        }))
      } else {
        if (boardColumnLoadingMoreRef.current[columnId]) return
        boardColumnLoadingMoreRef.current[columnId] = true
        setBoardColumns((prev) => ({
          ...prev,
          [columnId]: {
            ...(prev[columnId] ?? EMPTY_BOARD_COLUMN),
            loadingMore: true,
          },
        }))
      }
      try {
        const data = await fetchBookingItemsBoardPage(pageNum, {
          boardColumnId: columnId,
        })
        setBoardColumns((prev) => {
          const prior = prev[columnId] ?? EMPTY_BOARD_COLUMN
          return {
            ...prev,
            [columnId]: {
              items: replace
                ? data.results
                : [...prior.items, ...data.results],
              total: data.count,
              page: pageNum,
              hasMore: data.next !== null,
              loading: false,
              loadingMore: false,
            },
          }
        })
      } catch {
        if (replace) {
          setBoardColumns((prev) => ({
            ...prev,
            [columnId]: { ...EMPTY_BOARD_COLUMN, loading: false },
          }))
        }
      } finally {
        boardColumnLoadingMoreRef.current[columnId] = false
        setBoardColumns((prev) => {
          const col = prev[columnId]
          if (!col) return prev
          return {
            ...prev,
            [columnId]: { ...col, loading: false, loadingMore: false },
          }
        })
      }
    },
    [],
  )

  const loadForeignBoardPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) {
        setForeignBoard((prev) => ({ ...prev, loading: true }))
      } else {
        if (foreignBoardLoadingMoreRef.current) return
        foreignBoardLoadingMoreRef.current = true
        setForeignBoard((prev) => ({ ...prev, loadingMore: true }))
      }
      try {
        const data = await fetchBookingItemsBoardPage(pageNum, { foreign: true })
        setForeignBoard((prev) => ({
          items: replace ? data.results : [...prev.items, ...data.results],
          total: data.count,
          page: pageNum,
          hasMore: data.next !== null,
          loading: false,
          loadingMore: false,
        }))
      } catch {
        if (replace) setForeignBoard(EMPTY_BOARD_COLUMN)
      } finally {
        foreignBoardLoadingMoreRef.current = false
        setForeignBoard((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
        }))
      }
    },
    [],
  )

  const loadBoardSearchPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) {
        setBoardSearch((prev) => ({ ...prev, loading: true }))
      } else {
        if (boardSearchLoadingMoreRef.current) return
        boardSearchLoadingMoreRef.current = true
        setBoardSearch((prev) => ({ ...prev, loadingMore: true }))
      }
      try {
        const data = await fetchBookingItemsBoardPage(pageNum, {
          search: debouncedSearch,
        })
        setBoardSearch((prev) => ({
          items: replace ? data.results : [...prev.items, ...data.results],
          total: data.count,
          page: pageNum,
          hasMore: data.next !== null,
          loading: false,
          loadingMore: false,
        }))
      } catch {
        if (replace) setBoardSearch(EMPTY_BOARD_COLUMN)
      } finally {
        boardSearchLoadingMoreRef.current = false
        setBoardSearch((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
        }))
      }
    },
    [debouncedSearch],
  )

  const loadCardsPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) {
        setCardsLoading(true)
      } else {
        if (cardsLoadingMoreRef.current) return
        cardsLoadingMoreRef.current = true
        setCardsLoadingMore(true)
      }
      try {
        const data = await fetchBookingItemsBoardPage(pageNum, {
          search: debouncedSearch.trim() ? debouncedSearch : undefined,
        })
        setCardsTotal(data.count)
        setCardsHasMore(data.next !== null)
        setCardsPage(pageNum)
        setCardsItems((prev) =>
          replace ? data.results : [...prev, ...data.results],
        )
      } catch {
        if (replace) {
          setCardsItems([])
          setCardsTotal(0)
          setCardsHasMore(false)
          setCardsPage(0)
        }
      } finally {
        if (replace) {
          setCardsLoading(false)
        } else {
          cardsLoadingMoreRef.current = false
          setCardsLoadingMore(false)
        }
      }
    },
    [debouncedSearch],
  )

  const reloadCardsBookings = useCallback(() => {
    void loadCardsPage(1, true)
  }, [loadCardsPage])

  const reloadBoardData = useCallback(() => {
    if (debouncedSearch.trim()) {
      void loadBoardSearchPage(1, true)
      return
    }
    columns.forEach((col) => {
      void loadBoardColumnPage(col.id, 1, true)
    })
    void loadForeignBoardPage(1, true)
  }, [
    columns,
    debouncedSearch,
    loadBoardColumnPage,
    loadBoardSearchPage,
    loadForeignBoardPage,
  ])

  const reloadBoardColumn = useCallback(
    (columnId: number) => {
      void loadBoardColumnPage(columnId, 1, true)
    },
    [loadBoardColumnPage],
  )

  useEffect(() => {
    if (activeView !== 'list') return
    void loadListPage(1, true)
  }, [activeView, loadListPage])

  useEffect(() => {
    if (columns.length === 0) return
    if (debouncedSearch.trim()) {
      if (activeView === 'board') void loadBoardSearchPage(1, true)
      if (activeView === 'cards') void loadCardsPage(1, true)
      return
    }
    if (activeView === 'board') {
      columns.forEach((col) => {
        void loadBoardColumnPage(col.id, 1, true)
      })
      void loadForeignBoardPage(1, true)
      return
    }
    if (activeView === 'cards') {
      void loadCardsPage(1, true)
    }
  }, [
    activeView,
    columns,
    debouncedSearch,
    loadBoardColumnPage,
    loadBoardSearchPage,
    loadForeignBoardPage,
    loadCardsPage,
  ])

  const boardSearchSentinelRef = useRef<HTMLDivElement | null>(null)

  const loadNextListPage = useCallback(() => {
    if (!listHasMore || listLoading || listLoadingMore) return
    void loadListPage(listPage + 1, false)
  }, [listHasMore, listLoading, listLoadingMore, listPage, loadListPage])

  useEffect(() => {
    if (activeView !== 'list') return
    const sentinel = listSentinelRef.current
    const root = listScrollRef.current
    if (!sentinel || !listHasMore || listLoading || listLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextListPage()
        }
      },
      { root, rootMargin: '160px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    activeView,
    listHasMore,
    listLoading,
    listLoadingMore,
    listItems.length,
    loadNextListPage,
  ])

  const listCanReorder =
    !listHasMore && debouncedSearch.trim() === '' && listItems.length > 0

  const boardViewActive = activeView === 'board'
  const cardsViewActive = activeView === 'cards'
  const boardSearchActive =
    (boardViewActive || cardsViewActive) && debouncedSearch.trim().length > 0

  const boardLoading = useMemo(() => {
    if (!boardViewActive) return false
    if (loading) return true
    if (boardSearchActive) {
      return boardSearch.loading && boardSearch.items.length === 0
    }
    if (columns.length === 0) return false

    const hasAnyItems =
      columns.some((col) => (boardColumns[col.id]?.items.length ?? 0) > 0) ||
      foreignBoard.items.length > 0
    if (hasAnyItems) return false

    return (
      columns.some((col) => !boardColumns[col.id] || boardColumns[col.id].loading) ||
      foreignBoard.loading
    )
  }, [
    boardViewActive,
    loading,
    boardSearchActive,
    boardSearch.loading,
    boardSearch.items.length,
    columns,
    boardColumns,
    foreignBoard.loading,
    foreignBoard.items.length,
  ])

  const boardSkeletonColumns = Math.max(columns.length, 3)

  const cardsDisplayItems = useMemo(() => {
    if (!cardsViewActive) return []
    return cardsItems
  }, [cardsViewActive, cardsItems])

  const { itemsByColumn, foreignUnmatchedItems } = useMemo(() => {
    const map = new Map<number, BookingItem[]>()
    const unmatched: BookingItem[] = []
    columns.forEach((c) => map.set(c.id, []))

    const sourceItems = boardSearchActive
      ? boardSearch.items
      : [
          ...columns.flatMap((c) => boardColumns[c.id]?.items ?? []),
          ...foreignBoard.items,
        ]

    sourceItems.forEach((it) => {
      if (bookingHasLocalStatusColumn(it, columns)) {
        map.get(it.status)!.push(it)
        return
      }
      const columnId = bookingColumnIdForItem(it, columns)
      if (columnId != null) {
        map.get(columnId)!.push(it)
        return
      }
      if (bookingIsFromOtherCompany(it)) {
        unmatched.push(it)
      }
    })

    if (!boardSearchActive) {
      return {
        itemsByColumn: map,
        foreignUnmatchedItems: foreignBoard.items,
      }
    }
    return { itemsByColumn: map, foreignUnmatchedItems: unmatched }
  }, [
    boardSearchActive,
    boardSearch.items,
    boardColumns,
    columns,
    foreignBoard.items,
  ])

  const boardFlatItems = useMemo(() => {
    if (!boardViewActive) return []
    if (boardSearchActive) return boardSearch.items
    return [
      ...columns.flatMap((c) => boardColumns[c.id]?.items ?? []),
      ...foreignBoard.items,
    ]
  }, [
    boardViewActive,
    boardSearchActive,
    boardSearch.items,
    boardColumns,
    columns,
    foreignBoard.items,
  ])

  const allBoardItemsLoaded = useMemo(() => {
    if (boardSearchActive) {
      return !boardSearch.hasMore && !boardSearch.loading
    }
    if (columns.length === 0) return true
    const colsReady = columns.every((c) => {
      const col = boardColumns[c.id]
      return col && !col.loading && !col.hasMore
    })
    const foreignReady =
      foreignBoard.total === 0
        ? !foreignBoard.loading && !foreignBoard.loadingMore
        : !foreignBoard.loading && !foreignBoard.hasMore
    return colsReady && foreignReady
  }, [boardSearchActive, boardSearch, boardColumns, columns, foreignBoard])

  const boardCanReorder =
    boardViewActive && !boardSearchActive && allBoardItemsLoaded

  const cardsCanReorder =
    cardsViewActive &&
    !boardSearchActive &&
    !cardsHasMore &&
    !cardsLoading &&
    cardsItems.length > 0

  useEffect(() => {
    if (activeView !== 'board' || boardSearchActive) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const raw = entry.target.getAttribute('data-column-id')
          const colId = raw != null ? Number(raw) : NaN
          if (colId === FOREIGN_BOARD_KEY) {
            if (
              foreignBoard.hasMore &&
              !foreignBoard.loading &&
              !foreignBoard.loadingMore
            ) {
              void loadForeignBoardPage(foreignBoard.page + 1, false)
            }
            continue
          }
          if (!Number.isFinite(colId)) continue
          const col = boardColumns[colId]
          if (col?.hasMore && !col.loading && !col.loadingMore) {
            void loadBoardColumnPage(colId, col.page + 1, false)
          }
        }
      },
      { rootMargin: '160px' },
    )

    columns.forEach((c) => {
      const el = columnSentinelRefs.current.get(c.id)
      if (el) observer.observe(el)
    })
    if (foreignSentinelRef.current) {
      observer.observe(foreignSentinelRef.current)
    }
    return () => observer.disconnect()
  }, [
    activeView,
    boardSearchActive,
    boardColumns,
    columns,
    foreignBoard,
    loadBoardColumnPage,
    loadForeignBoardPage,
  ])

  useEffect(() => {
    if (!boardSearchActive || activeView !== 'board') return
    const sentinel = boardSearchSentinelRef.current
    if (!sentinel || !boardSearch.hasMore || boardSearch.loading || boardSearch.loadingMore) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadBoardSearchPage(boardSearch.page + 1, false)
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    activeView,
    boardSearchActive,
    boardSearch.hasMore,
    boardSearch.loading,
    boardSearch.loadingMore,
    boardSearch.page,
    boardSearch.items.length,
    loadBoardSearchPage,
  ])

  const loadNextCardsPage = useCallback(() => {
    if (!cardsHasMore || cardsLoading || cardsLoadingMore) return
    void loadCardsPage(cardsPage + 1, false)
  }, [cardsHasMore, cardsLoading, cardsLoadingMore, cardsPage, loadCardsPage])

  useEffect(() => {
    if (activeView !== 'cards') return
    const sentinel = cardsSentinelRef.current
    const root = cardsScrollRef.current
    if (!sentinel || !cardsHasMore || cardsLoading || cardsLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextCardsPage()
        }
      },
      { root, rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    activeView,
    cardsHasMore,
    cardsLoading,
    cardsLoadingMore,
    cardsDisplayItems.length,
    loadNextCardsPage,
  ])

  const listRefs = useRef<Map<number, HTMLDivElement | null>>(new Map())
  const dragRef = useRef<DragState | null>(null)

  // --- Cards grid drag-reorder --------------------------------------------
  type CardsDragState = { itemId: number; targetIndex: number }
  const [cardsDrag, setCardsDrag] = useState<CardsDragState | null>(null)
  const cardsDragRef = useRef<CardsDragState | null>(null)
  const cardsGridRef = useRef<HTMLDivElement | null>(null)

  const handleCardDragStart = (
    e: DragEvent<HTMLElement>,
    item: BookingItem,
    sourceIndex: number,
  ) => {
    if (!canMutate(item)) {
      e.preventDefault()
      return
    }
    const target = e.target as HTMLElement
    if (target.closest('button, [data-no-drag]')) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', String(item.id))
    } catch {
      // ignore
    }
    const initial: CardsDragState = { itemId: item.id, targetIndex: sourceIndex }
    cardsDragRef.current = initial
    window.setTimeout(() => {
      if (cardsDragRef.current === initial) {
        setCardsDrag(initial)
      }
    }, 0)
  }

  const computeGridInsertIndex = (
    e: DragEvent<HTMLDivElement>,
    grid: HTMLDivElement,
  ): number => {
    const cards = Array.from(
      grid.querySelectorAll<HTMLElement>('[data-card-grid-id]'),
    )
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect()
      if (e.clientY < rect.top) {
        return i
      }
      const midX = rect.left + rect.width / 2
      if (e.clientY <= rect.bottom && e.clientX < midX) {
        return i
      }
    }
    return cards.length
  }

  const handleCardsGridDragOver = (e: DragEvent<HTMLDivElement>) => {
    const current = cardsDrag ?? cardsDragRef.current
    if (!current) {
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const grid = cardsGridRef.current
    if (!grid) {
      return
    }
    const idx = computeGridInsertIndex(e, grid)
    if (current.targetIndex !== idx) {
      const next: CardsDragState = { ...current, targetIndex: idx }
      cardsDragRef.current = next
      setCardsDrag(next)
    }
  }

  const handleCardsGridDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!bookingsWrite || !cardsCanReorder) {
      return
    }
    const current = cardsDrag ?? cardsDragRef.current
    if (!current) {
      return
    }
    const prev = cardsDisplayItems
    const sourceIdx = prev.findIndex((it) => it.id === current.itemId)
    if (sourceIdx < 0) {
      return
    }
    const source = prev[sourceIdx]
    let postMoveIndex = current.targetIndex
    if (current.targetIndex > sourceIdx) {
      postMoveIndex = current.targetIndex - 1
    }
    const without = prev.filter((it) => it.id !== current.itemId)
    const clamped = Math.max(0, Math.min(postMoveIndex, without.length))
    const next = [...without]
    next.splice(clamped, 0, source)
    const updates = next.map((it, idx) => ({
      id: it.id,
      status: it.status,
      sort_order: idx,
    }))
    reorderBookingItems(updates)
      .then(() => {
        reloadBoardData()
        reloadCardsBookings()
      })
      .catch(() => {})
    cardsDragRef.current = null
    setCardsDrag(null)
  }

  const handleCardDragEnd = () => {
    cardsDragRef.current = null
    setCardsDrag(null)
  }

  // --- List drag-reorder ---------------------------------------------------
  type ListDragState = { itemId: number; targetIndex: number }
  const [listDrag, setListDrag] = useState<ListDragState | null>(null)
  const listDragRef = useRef<ListDragState | null>(null)
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null)

  const handleRowDragStart = (
    e: DragEvent<HTMLTableRowElement>,
    item: BookingItem,
    sourceIndex: number,
  ) => {
    if (!canMutate(item)) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', String(item.id))
    } catch {
      // ignore
    }
    const initial: ListDragState = { itemId: item.id, targetIndex: sourceIndex }
    listDragRef.current = initial
    window.setTimeout(() => {
      if (listDragRef.current === initial) {
        setListDrag(initial)
      }
    }, 0)
  }

  const handleTbodyDragOver = (e: DragEvent<HTMLTableSectionElement>) => {
    const current = listDrag ?? listDragRef.current
    if (!current) {
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const tbody = tbodyRef.current
    if (!tbody) {
      return
    }
    const rows = Array.from(
      tbody.querySelectorAll<HTMLElement>('tr[data-row-id]'),
    )
    let idx = rows.length
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) {
        idx = i
        break
      }
    }
    if (current.targetIndex !== idx) {
      const next: ListDragState = { ...current, targetIndex: idx }
      listDragRef.current = next
      setListDrag(next)
    }
  }

  const handleTbodyDrop = (e: DragEvent<HTMLTableSectionElement>) => {
    e.preventDefault()
    if (!bookingsWrite) {
      return
    }
    const current = listDrag ?? listDragRef.current
    if (!current) {
      return
    }
    const applyReorder = (prev: BookingItem[]) => {
      const sourceIdx = prev.findIndex((it) => it.id === current.itemId)
      if (sourceIdx < 0) {
        return prev
      }
      const source = prev[sourceIdx]
      let postMoveIndex = current.targetIndex
      if (current.targetIndex > sourceIdx) {
        postMoveIndex = current.targetIndex - 1
      }
      const without = prev.filter((it) => it.id !== current.itemId)
      const clamped = Math.max(0, Math.min(postMoveIndex, without.length))
      const next = [...without]
      next.splice(clamped, 0, source)
      const updates = next.map((it, idx) => ({
        id: it.id,
        status: it.status,
        sort_order: idx,
      }))
      reorderBookingItems(updates).catch(() => {})
      return next
    }
    if (listCanReorder) {
      setListItems(applyReorder)
    }
    listDragRef.current = null
    setListDrag(null)
  }

  const handleRowDragEnd = () => {
    listDragRef.current = null
    setListDrag(null)
  }

  // --- Board pan -----------------------------------------------------------
  const boardRef = useRef<HTMLDivElement | null>(null)
  const panRef = useRef<{
    active: boolean
    pointerId: number
    startX: number
    startScrollLeft: number
  }>({ active: false, pointerId: -1, startX: 0, startScrollLeft: 0 })

  const handleBoardPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return
    }
    const target = e.target as HTMLElement
    if (target.closest('.kanban-column')) {
      return
    }
    const board = boardRef.current
    if (!board) {
      return
    }
    panRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startScrollLeft: board.scrollLeft,
    }
    board.classList.add('is-panning')
    try {
      board.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handleBoardPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active) {
      return
    }
    const board = boardRef.current
    if (!board) {
      return
    }
    const dx = e.clientX - panRef.current.startX
    board.scrollLeft = panRef.current.startScrollLeft - dx
  }

  const endBoardPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active) {
      return
    }
    const board = boardRef.current
    if (board) {
      board.classList.remove('is-panning')
      try {
        board.releasePointerCapture(panRef.current.pointerId)
      } catch {
        // ignore
      }
    }
    panRef.current.active = false
    panRef.current.pointerId = -1
    const dx = Math.abs(e.clientX - panRef.current.startX)
    if (dx > 4) {
      e.preventDefault()
    }
  }

  // --- Drag handlers -------------------------------------------------------

  const handleItemDragStart = (
    e: DragEvent<HTMLDivElement>,
    item: BookingItem,
    indexInColumn: number,
  ) => {
    if (!canMutate(item)) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', String(item.id))
    } catch {
      // ignore
    }

    const initial: DragState = {
      itemId: item.id,
      sourceColumnId: item.status,
      targetColumnId: item.status,
      targetIndex: indexInColumn,
    }

    dragRef.current = initial

    window.setTimeout(() => {
      if (dragRef.current === initial) {
        setDrag(initial)
      }
    }, 0)
  }

  const handleColumnDragOver = (
    e: DragEvent<HTMLDivElement>,
    columnId: number,
  ) => {
    const current = drag ?? dragRef.current
    if (!current) {
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const listEl = listRefs.current.get(columnId)
    if (!listEl) {
      return
    }
    const idx = computeDropIndex(e, listEl)
    if (current.targetColumnId !== columnId || current.targetIndex !== idx) {
      const next: DragState = { ...current, targetColumnId: columnId, targetIndex: idx }
      dragRef.current = next
      setDrag(next)
    }
  }

  const handleColumnDrop = (
    e: DragEvent<HTMLDivElement>,
    columnId: number,
  ) => {
    e.preventDefault()
    const current = drag ?? dragRef.current
    if (!current) {
      return
    }
    performMove(current.itemId, columnId, current.targetIndex)
    dragRef.current = null
    setDrag(null)
  }

  const handleDragEnd = () => {
    dragRef.current = null
    setDrag(null)
  }

  const performMove = (
    itemId: number,
    targetColumnId: number,
    renderedTargetIndex: number,
  ) => {
    if (!bookingsWrite || boardSearchActive) {
      return
    }
    const sourceKey = findBoardColumnKeyForItem(
      itemId,
      boardColumns,
      foreignBoard,
      columns,
    )
    if (sourceKey == null) {
      return
    }

    const sourceItems =
      sourceKey === FOREIGN_BOARD_KEY
        ? foreignBoard.items
        : (boardColumns[sourceKey]?.items ?? [])
    const source = sourceItems.find((it) => it.id === itemId)
    if (!source) {
      return
    }

    const targetItems = boardColumns[targetColumnId]?.items ?? []
    let postMoveIndex = renderedTargetIndex
    if (sourceKey === targetColumnId) {
      const sourceIndexInColumn = sourceItems.findIndex((it) => it.id === itemId)
      if (sourceIndexInColumn >= 0 && renderedTargetIndex > sourceIndexInColumn) {
        postMoveIndex = renderedTargetIndex - 1
      }
    }

    const withoutSource = sourceItems.filter((it) => it.id !== itemId)
    const clamped = Math.max(0, Math.min(postMoveIndex, targetItems.length))
    const moved: BookingItem = { ...source, status: targetColumnId }
    const nextTarget = [...targetItems]
    nextTarget.splice(clamped, 0, moved)

    const setColumnItems = (key: number, items: BookingItem[]) => {
      if (key === FOREIGN_BOARD_KEY) {
        setForeignBoard((prev) => ({ ...prev, items }))
      } else {
        setBoardColumns((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] ?? EMPTY_BOARD_COLUMN),
            items,
          },
        }))
      }
    }

    setColumnItems(sourceKey, withoutSource)
    setColumnItems(targetColumnId, nextTarget)

    const updates = nextTarget.map((it, idx) => ({
      id: it.id,
      status: targetColumnId,
      sort_order: idx,
    }))
    if (sourceKey !== targetColumnId) {
      withoutSource.forEach((it, idx) => {
        updates.push({
          id: it.id,
          status: it.status,
          sort_order: idx,
        })
      })
    }
    reorderBookingItems(updates).catch(() => {
      reloadBoardData()
    })
  }

  // --- Status CRUD ---------------------------------------------------------

  const openCreateStatus = () => {
    if (!statusesWrite) return
    setStatusModal({
      mode: 'create',
      id: null,
      title: '',
      description: '',
      color: COLOR_SWATCHES[0],
      tags: [],
    })
  }

  const openEditStatus = (column: BookingColumn) => {
    if (!statusesWrite) return
    setStatusModal({
      mode: 'edit',
      id: column.id,
      title: column.title,
      description: column.description,
      color: column.color,
      tags: (column.tags ?? []).map((t) => ({ id: t.id, tag: t.tag })),
    })
  }

  const handleStatusSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!statusesWrite || !statusModal) {
      return
    }
    const title = statusModal.title.trim() || 'Untitled'
    const description = statusModal.description.trim()
    const color = statusModal.color || '#1f3a5f'
    const tag_ids = statusModal.tags.map((t) => t.id)

    try {
      if (statusModal.mode === 'create') {
        const created = await createBookingStatus({
          title,
          description,
          color,
          tag_ids,
        })
        setColumns((prev) => [...prev, created])
      } else if (statusModal.id) {
        const updated = await updateBookingStatus(statusModal.id, {
          title,
          description,
          color,
          tag_ids,
        })
        setColumns((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        )
      }
    } catch {
      // silently fail
    }
    setStatusModal(null)
  }

  const handleDeleteStatus = async (column: BookingColumn) => {
    if (!statusesWrite) return
    const count = itemsByColumn.get(column.id)?.length ?? 0
    const msg =
      count > 0
        ? `Delete status "${column.title}"? Its ${count} quotation${
            count === 1 ? '' : 's'
          } will also be removed.`
        : `Delete status "${column.title}"?`
    if (!window.confirm(msg)) {
      return
    }
    try {
      await deleteBookingStatus(column.id)
      setColumns((prev) => prev.filter((c) => c.id !== column.id))
      setBoardColumns((prev) => {
        const next = { ...prev }
        delete next[column.id]
        return next
      })
      reloadBoardData()
    } catch {
      // silently fail
    }
  }

  // --- Item CRUD -----------------------------------------------------------

  const clearEditParam = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!next.has(EDIT_PARAM)) {
          return prev
        }
        next.delete(EDIT_PARAM)
        return next
      },
      { replace: true },
    )
  }

  const closeItemModal = () => {
    suppressEditFromUrl.current = true
    setItemSaving(false)
    setItemModalLoading(false)
    setItemModal(null)
    setModalBookingGroups([])
    clearEditParam()
  }

  const populateItemModal = useCallback(
    async (item: BookingItem, options?: { updateUrl?: boolean }) => {
      if (options?.updateUrl !== false) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.set(EDIT_PARAM, String(item.id))
            return next
          },
          { replace: true },
        )
      }

      if (bookingItemNeedsFullFetch(item)) {
        setItemModalLoading(true)
        setModalBookingGroups([])
        setItemModal({
          ...bookingItemToEditForm({ ...item, field_values: [] }),
          canEdit: canMutate(item),
        })
        try {
          const full = await fetchBookingItem(item.id)
          setModalBookingGroups(full.groups ?? [])
          setItemModal({
            ...bookingItemToEditForm(full),
            canEdit: canMutate(full),
          })
        } catch {
          showErrorToast('Could not load quotation details.')
          suppressEditFromUrl.current = true
          setItemModalLoading(false)
          setItemModal(null)
          setModalBookingGroups([])
          clearEditParam()
        } finally {
          setItemModalLoading(false)
        }
        return
      }

      setItemModalLoading(false)
      setModalBookingGroups(item.groups ?? [])
      setItemModal({
        ...bookingItemToEditForm(item),
        canEdit: canMutate(item),
      })
    },
    [canMutate, setSearchParams],
  )

  const handleDeleteBookingGroup = async (bookingId: number, groupId: number) => {
    await deleteBookingGroup(bookingId, groupId)
    if (itemModal?.id === bookingId) {
      const full = await fetchBookingItem(bookingId)
      setItemModal(bookingItemToEditForm(full))
    }
    reloadBoardData()
    reloadCardsBookings()
    reloadListBookings()
  }

  const openCreateItem = (statusId: number) => {
    if (!bookingsWrite) return
    setItemModalLoading(false)
    setItemModal({
      mode: 'create',
      id: null,
      statusId,
      contactId: null,
      title: '',
      dateOfEvent: '',
      timeOfEvent: '',
      fields: [],
      notes: '',
      totalAmount: '',
      canEdit: true,
    })
  }

  const openEditItem = (item: BookingItem) => {
    void populateItemModal(item)
  }

  const handleSendToCalendar = async () => {
    if (!itemModal?.id) return
    if (!itemModal.dateOfEvent.trim()) {
      showErrorToast('Set a date of event before sending to calendar.')
      return
    }
    setAppointmentModalError(null)
    setAppointmentLoadingOptions(true)
    try {
      const [contactRows, statusRows] = await Promise.all([
        fetchContacts(),
        fetchCalendarStatuses(),
      ])
      const sortedStatuses = [...statusRows].sort(
        (a, b) => a.sort_order - b.sort_order || a.id - b.id,
      )
      const defaultStatusId = sortedStatuses[0]?.id ?? null
      const apptForm = appointmentFormFromBooking(itemModal, defaultStatusId)
      if (!apptForm) {
        showErrorToast('Could not build appointment from quotation.')
        return
      }
      setAppointmentContacts(contactRows)
      setAppointmentStatuses(sortedStatuses)
      setAppointmentModal(apptForm)
    } catch {
      showErrorToast('Could not load calendar options.')
    } finally {
      setAppointmentLoadingOptions(false)
    }
  }

  const handleAppointmentModalClose = () => {
    setAppointmentModal(null)
    setAppointmentModalError(null)
  }

  const handleAppointmentSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!appointmentModal) return

    const startMs = new Date(appointmentModal.startValue).getTime()
    const endMs = new Date(appointmentModal.endValue).getTime()
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
      setAppointmentModalError('End must be on or after start.')
      return
    }

    setAppointmentSaving(true)
    setAppointmentModalError(null)
    try {
      await createCalendarEvent(appointmentPayloadFromForm(appointmentModal))
      showSuccessToast('Appointment created on calendar.')
      handleAppointmentModalClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed'
      setAppointmentModalError(message)
      showErrorToast(message)
    } finally {
      setAppointmentSaving(false)
    }
  }

  const handlePricingApplied = useCallback(
    async (adjustment: QuotationPricingAdjustment) => {
      if (!itemModal || itemModal.mode !== 'edit' || itemModal.id == null) {
        return
      }
      const fieldsForSave = itemModal.fields.filter((field) => field.saved)
      const payload = quotationPricingPayloadFromForm(
        fieldsForSave,
        itemModal.extraGroupNames ?? [],
        modalBookingGroups ?? [],
        adjustment,
      )
      const updated = await updateBookingItem(itemModal.id, payload)
      const pricingAdjustment = quotationPricingAdjustmentFromApiItem(updated)
      setItemModal({
        ...itemModal,
        discountAmount: pricingAdjustment.discountAmount,
        discountType: pricingAdjustment.discountType,
        overrideTotalAmount: pricingAdjustment.overrideTotalAmount,
        totalAmount:
          (updated.total_amount ?? payload.total_amount).trim() ||
          payload.total_amount,
      })
    },
    [itemModal, modalBookingGroups],
  )

  const handleItemSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!itemModal) {
      return
    }
    if (!bookingsWrite) {
      return
    }
    if (itemModal.mode === 'edit' && itemModal.canEdit === false) {
      return
    }
    const submitter = e.nativeEvent.submitter
    const closeAfterSave = submitter?.getAttribute('data-close-after') === 'true'
    const title = itemModal.title.trim() || 'Untitled'
    const notes = itemModal.notes
    const statusId = itemModal.statusId
    const contact = itemModal.contactId
    let date_of_event: string | null = null
    if (itemModal.dateOfEvent) {
      date_of_event = itemModal.timeOfEvent
        ? `${itemModal.dateOfEvent}T${itemModal.timeOfEvent}`
        : `${itemModal.dateOfEvent}T00:00`
    }

    const { fields: fieldsForSave, error: finalizeError } =
      finalizeBookingFieldDefinitions(itemModal.fields)
    if (finalizeError) {
      showErrorToast(`Finish setting up custom fields: ${finalizeError}`)
      return
    }
    if (fieldsForSave !== itemModal.fields) {
      setItemModal({ ...itemModal, fields: fieldsForSave })
    }

    const missingRequired = fieldsForSave.filter((f) => {
      if (!f.saved || !f.is_required) return false
      if (f.field_type === 'supplier') {
        const { package_id, supplier_id } = parseSupplierFieldValue(f.value)
        return package_id == null || supplier_id == null
      }
      if (f.field_type === 'checkbox') return f.value !== 'true'
      return !f.value.trim()
    })
    if (missingRequired.length > 0) {
      showErrorToast(
        `Fill required fields: ${missingRequired.map((f) => f.label || 'Untitled').join(', ')}.`,
      )
      return
    }

    for (const field of fieldsForSave) {
      if (!field.saved) continue
      const downpaymentError =
        field.field_type === 'supplier'
          ? validateBookingSupplierFieldDownpayment(field)
          : validateBookingFieldDownpayment(field)
      if (downpaymentError) {
        showErrorToast(
          `${field.label.trim() || 'Field'}: ${downpaymentError}`,
        )
        return
      }
    }

    try {
      setItemSaving(true)
      const field_values = fieldsToFieldValues(fieldsForSave)
      const groups = buildBookingGroupsPayload(
        fieldsForSave,
        itemModal.extraGroupNames ?? [],
      )
      let apiGroups: BookingItem['groups'] = []
      if (itemModal.id != null) {
        const existing = await fetchBookingItem(itemModal.id)
        apiGroups = existing.groups ?? []
      }
      const pricingPayload = quotationPricingPayloadFromForm(
        fieldsForSave,
        itemModal.extraGroupNames ?? [],
        apiGroups,
        quotationPricingAdjustmentFromForm(itemModal),
      )
      const required_downpayment_amount = bookingPriceSummaryRequiredDownpaymentAmount(
        fieldsForSave,
      )
      if (itemModal.mode === 'create') {
        const created = await createBookingItem({
          status: statusId,
          contact,
          title,
          date_of_event,
          ...pricingPayload,
          required_downpayment_amount,
          groups,
          field_values,
          notes,
        })
        reloadBoardData()
        reloadCardsBookings()
        reloadBoardColumn(statusId)
        if (!closeAfterSave) {
          setItemModal({
            ...bookingItemToEditForm(created),
            totalAmount: (created.total_amount ?? pricingPayload.total_amount).trim() || pricingPayload.total_amount,
            requiredDownpaymentAmount:
              (created.required_downpayment_amount ?? required_downpayment_amount).trim() ||
              required_downpayment_amount,
            paidAmount: created.paid_amount ?? '0',
            paidChargeAmount: created.paid_charge_amount ?? '0',
            paidProcessingFees: created.paid_processing_fees ?? '0',
            paidPlatformFees: created.paid_platform_fees ?? '0',
            refundedAmount: created.refunded_amount ?? '0',
          })
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.set(EDIT_PARAM, String(created.id))
              return next
            },
            { replace: true },
          )
        }
      } else if (itemModal.id) {
        const updated = await updateBookingItem(itemModal.id, {
          title,
          date_of_event,
          ...pricingPayload,
          required_downpayment_amount,
          groups,
          field_values,
          notes,
          status: statusId,
          contact,
        })
        reloadBoardData()
        reloadCardsBookings()
        if (!closeAfterSave) {
          setItemModal({
            ...bookingItemToEditForm(updated),
            totalAmount: (updated.total_amount ?? pricingPayload.total_amount).trim() || pricingPayload.total_amount,
            requiredDownpaymentAmount:
              (updated.required_downpayment_amount ?? required_downpayment_amount).trim() ||
              required_downpayment_amount,
            paidAmount: updated.paid_amount ?? itemModal.paidAmount ?? '0',
            paidChargeAmount:
              updated.paid_charge_amount ?? itemModal.paidChargeAmount ?? '0',
            paidProcessingFees:
              updated.paid_processing_fees ?? itemModal.paidProcessingFees ?? '0',
            paidPlatformFees:
              updated.paid_platform_fees ?? itemModal.paidPlatformFees ?? '0',
            refundedAmount:
              updated.refunded_amount ?? itemModal.refundedAmount ?? '0',
          })
        }
      }
      clearBookingDraft(itemModal.id)
      setBookingHistoryRefresh((k) => k + 1)
      reloadListBookings()
      showSuccessToast(
        itemModal.mode === 'create' ? 'Quotation created.' : 'Quotation saved.',
      )
      if (closeAfterSave) {
        closeItemModal()
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save quotation.'
      showErrorToast(message)
    } finally {
      setItemSaving(false)
    }
  }

  const handleDeleteItem = async (item: BookingItem) => {
    if (!canMutate(item)) return
    if (!window.confirm(`Delete card "${item.title}"?`)) {
      return
    }
    try {
      await deleteBookingItem(item.id)
      reloadBoardData()
      reloadCardsBookings()
      reloadListBookings()
      if (itemModal?.id === item.id) {
        closeItemModal()
      } else if (searchParams.get(EDIT_PARAM) === String(item.id)) {
        clearEditParam()
      }
    } catch {
      // silently fail
    }
  }

  // --- Restore edit modal from URL -----------------------------------------

  useEffect(() => {
    if (loading) return
    if (suppressEditFromUrl.current) {
      if (!searchParams.get(EDIT_PARAM)) {
        suppressEditFromUrl.current = false
      }
      return
    }
    const targetId = searchParams.get(EDIT_PARAM)
    if (!targetId) {
      return
    }
    const numId = Number(targetId)
    if (!Number.isFinite(numId)) {
      clearEditParam()
      return
    }
    if (isItemModalHydrated(itemModal, numId, itemModalLoading)) {
      return
    }
    if (itemModalLoading && itemModal?.id === numId) {
      return
    }

    const findLoaded = (): BookingItem | undefined => {
      if (activeView === 'list') {
        return listItems.find((it) => it.id === numId)
      }
      if (activeView === 'cards') {
        return cardsItems.find((it) => it.id === numId)
      }
      if (boardSearchActive) {
        return boardSearch.items.find((it) => it.id === numId)
      }
      for (const col of columns) {
        const found = boardColumns[col.id]?.items.find((it) => it.id === numId)
        if (found) return found
      }
      return foreignBoard.items.find((it) => it.id === numId)
    }

    const loaded = findLoaded()
    const fallbackStatusId = loaded?.status ?? columns[0]?.id ?? 0
    void populateItemModal(
      loaded ?? bookingItemStub(numId, fallbackStatusId),
      { updateUrl: false },
    )
  }, [
    loading,
    searchParams,
    activeView,
    boardColumns,
    boardSearch.items,
    boardSearchActive,
    cardsItems,
    columns,
    foreignBoard.items,
    itemModal,
    itemModalLoading,
    listItems,
    populateItemModal,
  ])

  // --- Escape to close modals ----------------------------------------------

  useEffect(() => {
    if (!statusModal && !itemModal) {
      return
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStatusModal(null)
        if (itemModal) {
          closeItemModal()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [statusModal, itemModal])

  // --- Render --------------------------------------------------------------

  const renderColumn = (column: BookingColumn) => {
    const colState = boardColumns[column.id] ?? EMPTY_BOARD_COLUMN
    const columnItems = itemsByColumn.get(column.id) ?? []

    type Entry =
      | { kind: 'card'; item: BookingItem }
      | { kind: 'placeholder' }

    const isTarget = drag?.targetColumnId === column.id

    const entries: Entry[] = columnItems.map(
      (item) => ({ kind: 'card', item }) as Entry,
    )
    if (drag && isTarget) {
      const idx = Math.max(0, Math.min(drag.targetIndex, entries.length))
      entries.splice(idx, 0, { kind: 'placeholder' })
    }

    const count = boardSearchActive
      ? columnItems.length
      : colState.total || columnItems.length
    const countTitle =
      !boardSearchActive && colState.hasMore
        ? `${columnItems.length} of ${colState.total} cards`
        : `${count} card${count === 1 ? '' : 's'}`

    return (
      <section key={column.id} className="kanban-column">
        <header
          className="kanban-column-header"
          style={{ borderTopColor: column.color }}
        >
          <div className="kanban-column-title-row">
            <div className="kanban-column-title-wrap">
              <span
                className="kanban-column-swatch"
                style={{ backgroundColor: column.color }}
                aria-hidden="true"
              />
              <h6 className="kanban-column-title mb-0">{column.title}</h6>
              <span
                className="kanban-column-count badge text-bg-light"
                title={countTitle}
              >
                {count}
              </span>
            </div>
            {statusesWrite && (
              <div className="kanban-column-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-link p-1"
                  onClick={() => openEditStatus(column)}
                  aria-label={`Edit status ${column.title}`}
                  title="Edit status"
                >
                  <i className="bi bi-pencil-square" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-link p-1 text-danger"
                  onClick={() => handleDeleteStatus(column)}
                  aria-label={`Delete status ${column.title}`}
                  title="Delete status"
                >
                  <i className="bi bi-trash" />
                </button>
              </div>
            )}
          </div>
          <KanbanColumnStatusTags tags={column.tags} />
          {column.description && (
            <p className="kanban-column-description mb-0">
              {column.description}
            </p>
          )}
        </header>

        <div
          className={`kanban-column-cards kanban-column-cards--scroll${
            isTarget ? ' is-drop-target' : ''
          }`}
          ref={(el) => {
            listRefs.current.set(column.id, el)
          }}
          onDragOver={(e) => handleColumnDragOver(e, column.id)}
          onDrop={(e) => handleColumnDrop(e, column.id)}
        >
          {colState.loading && columnItems.length === 0 && (
            <p className="kanban-empty mb-0 text-muted">Loading…</p>
          )}
          {entries.length === 0 && !colState.loading && (
            <p className="kanban-empty mb-0">Drop cards here.</p>
          )}
          {entries.map((entry, idx) => {
            if (entry.kind === 'placeholder') {
              return (
                <div
                  key={`__placeholder-${idx}`}
                  className="kanban-placeholder"
                  aria-hidden="true"
                />
              )
            }
            const it = entry.item
            const isDragging = drag?.itemId === it.id
            return (
              <div
                key={it.id}
                data-card-id={it.id}
                className={`kanban-card${
                  isDragging ? ' kanban-card--dragging' : ''
                }`}
                draggable={boardCanReorder && canMutate(it)}
                onDragStart={(e) => handleItemDragStart(e, it, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => void openEditItem(it)}
              >
                <span
                  className="kanban-card-strip"
                  style={{ backgroundColor: column.color }}
                  aria-hidden="true"
                />
                <div className="kanban-card-body">
                  <div className="kanban-card-header">
                    <p className="kanban-card-booking-id mb-0">
                      {formatBookingId(it)}
                    </p>
                    <BookingPaymentStatusPill
                      item={it}
                      className="kanban-card-payment-status"
                    />
                  </div>
                  <p className="kanban-card-title mb-1">{it.title}</p>
                  {bookingUsesForeignStatus(it, columns) && (
                    <BookingForeignStatusNote item={it} />
                  )}
                  <p className="kanban-card-event-date mb-1">
                    <i className="bi bi-calendar-event me-1" aria-hidden="true" />
                    {formatBookingEventDate(it)}
                  </p>
                  {it.notes && (
                    <p className="kanban-card-notes mb-0">{it.notes}</p>
                  )}
                  <BookingOwnerCompanyLabel
                    item={it}
                    className="kanban-card-created-by"
                  />
                </div>
                {canMutate(it) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link p-0 kanban-card-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteItem(it)
                    }}
                    aria-label={`Delete card ${it.title}`}
                    title="Delete card"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
            )
          })}
          {!boardSearchActive && colState.hasMore && (
            <div
              ref={(el) => {
                columnSentinelRefs.current.set(column.id, el)
              }}
              data-column-id={column.id}
              className="kanban-column-sentinel"
              aria-hidden="true"
            />
          )}
          {!boardSearchActive &&
            !colState.hasMore &&
            columnItems.length > 0 &&
            !colState.loading && (
              <p className="kanban-column-end text-muted small mb-0">
                All {colState.total} loaded
              </p>
            )}
        </div>
      </section>
    )
  }

  const renderForeignUnmatchedColumn = () => {
    if (
      !boardSearchActive &&
      foreignBoard.total === 0 &&
      !foreignBoard.loading &&
      foreignUnmatchedItems.length === 0
    ) {
      return null
    }
    const columnItems = foreignUnmatchedItems
    const count = boardSearchActive
      ? columnItems.length
      : foreignBoard.total || columnItems.length
    const countTitle =
      !boardSearchActive && foreignBoard.hasMore
        ? `${columnItems.length} of ${foreignBoard.total} cards`
        : `${count} card${count === 1 ? '' : 's'}`
    const stripColor = '#6c757d'

    return (
      <section
        key="foreign-status-unmatched"
        className="kanban-column kanban-column--foreign-status"
      >
        <header
          className="kanban-column-header kanban-column-header--foreign-status"
          style={{ borderTopColor: stripColor }}
        >
          <div className="kanban-column-title-row">
            <div className="kanban-column-title-wrap">
              <span
                className="kanban-column-swatch"
                style={{ backgroundColor: stripColor }}
                aria-hidden="true"
              />
              <h6 className="kanban-column-title mb-0">
                {FOREIGN_UNMATCHED_COLUMN_TITLE}
              </h6>
              <span
                className="kanban-column-count badge text-bg-light"
                title={countTitle}
              >
                {count}
              </span>
            </div>
          </div>
          <p className="kanban-column-description kanban-column-description--foreign mb-0">
            All quotations here are from another company
          </p>
        </header>
        <div className="kanban-column-cards kanban-column-cards--scroll">
          {foreignBoard.loading && columnItems.length === 0 && (
            <p className="kanban-empty mb-0 text-muted">Loading…</p>
          )}
          {columnItems.length === 0 && !foreignBoard.loading && (
            <p className="kanban-empty mb-0">No quotations in this status.</p>
          )}
          {columnItems.map((it) => (
            <div
              key={it.id}
              data-card-id={it.id}
              className="kanban-card"
              onClick={() => void openEditItem(it)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openEditItem(it)
                }
              }}
            >
              <span
                className="kanban-card-strip"
                style={{ backgroundColor: stripColor }}
                aria-hidden="true"
              />
              <div className="kanban-card-body">
                <div className="kanban-card-header">
                  <p className="kanban-card-booking-id mb-0">
                    {formatBookingId(it)}
                  </p>
                  <BookingPaymentStatusPill
                    item={it}
                    className="kanban-card-payment-status"
                  />
                </div>
                <p className="kanban-card-title mb-1">{it.title}</p>
                <BookingForeignStatusNote item={it} />
                <p className="kanban-card-event-date mb-1">
                  <i className="bi bi-calendar-event me-1" aria-hidden="true" />
                  {formatBookingEventDate(it)}
                </p>
                {it.notes && (
                  <p className="kanban-card-notes mb-0">{it.notes}</p>
                )}
                <BookingOwnerCompanyLabel
                  item={it}
                  className="kanban-card-created-by"
                />
              </div>
            </div>
          ))}
          {!boardSearchActive && foreignBoard.hasMore && (
            <div
              ref={foreignSentinelRef}
              data-column-id={FOREIGN_BOARD_KEY}
              className="kanban-column-sentinel"
              aria-hidden="true"
            />
          )}
          {!boardSearchActive &&
            !foreignBoard.hasMore &&
            columnItems.length > 0 &&
            !foreignBoard.loading && (
              <p className="kanban-column-end text-muted small mb-0">
                All {foreignBoard.total} loaded
              </p>
            )}
        </div>
      </section>
    )
  }

  const renderAddColumnSlot = () => (
    <section
      className="kanban-column kanban-column--add-slot"
      aria-label="Add new status column"
    >
      <header
        className="kanban-column-header kanban-column-header--add-slot"
        style={{ borderTopColor: 'var(--brand-border)' }}
        aria-hidden="true"
      >
        <div className="kanban-column-title-row">
          <div className="kanban-column-title-wrap">
            <span className="kanban-column-swatch" />
            <h6 className="kanban-column-title mb-0">Status</h6>
            <span className="kanban-column-count badge text-bg-light">0</span>
          </div>
          <div className="kanban-column-actions">
            <span className="btn btn-sm btn-link p-1" tabIndex={-1}>
              <i className="bi bi-pencil-square" />
            </span>
            <span className="btn btn-sm btn-link p-1" tabIndex={-1}>
              <i className="bi bi-trash" />
            </span>
          </div>
        </div>
      </header>
      <div className="kanban-column-cards kanban-column-cards--add-slot">
        <p className="kanban-empty mb-0 kanban-empty--add-slot-placeholder" aria-hidden>
          Drop cards here.
        </p>
        {statusesWrite && (
          <div className="kanban-add-slot-cta">
            <button
              type="button"
              className="btn btn-outline-primary kanban-add-slot-btn"
              onClick={openCreateStatus}
            >
              <i className="bi bi-plus-lg me-1" aria-hidden="true" />
              Add new
            </button>
          </div>
        )}
      </div>
    </section>
  )

  if (loading && activeView !== 'board') {
    return (
      <div className="app-content">
        <div className="container-fluid">
          <div className="text-center py-5">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="bookings-toolbar-row">
          <div className="bookings-tabs-cluster">
            <div className="bookings-tabs" role="tablist" aria-label="Quotations views">
              {[
                { id: 'board', label: 'Board' },
                { id: 'cards', label: 'Cards' },
                { id: 'list', label: 'List' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className={`bookings-tab${activeView === tab.id ? ' is-active' : ''}`}
                  aria-selected={activeView === tab.id}
                  data-tour={`bookings-view-${tab.id}`}
                  onClick={() => setActiveView(tab.id as BookingsView)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {bookingsWrite && (
              <button
                type="button"
                className="btn btn-sm btn-primary bookings-add-booking-btn"
                disabled={columns.length === 0}
                title={
                  columns.length === 0
                    ? 'Add a status column on the Board first'
                    : 'New quotation in the first status column'
                }
                onClick={() => {
                  if (columns.length > 0) openCreateItem(columns[0].id)
                }}
              >
                <i className="bi bi-plus-lg me-1" aria-hidden="true" />
                Add quotation
              </button>
            )}
          </div>

          <div className="bookings-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              className="bookings-search-input"
              placeholder="Search quotations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search quotations"
            />
            {search && (
              <button
                type="button"
                className="bookings-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <i className="bi bi-x-lg" />
              </button>
            )}
          </div>

          {activeView === 'list' ? (
            <span className="bookings-search-count">
              {listTotal > 0
                ? `${listItems.length} of ${listTotal} quotation${listTotal !== 1 ? 's' : ''}`
                : `${listItems.length} quotation${listItems.length !== 1 ? 's' : ''}`}
            </span>
          ) : activeView === 'cards' ? (
            <span className="bookings-search-count">
              {cardsTotal > 0
                ? `${cardsItems.length} of ${cardsTotal} quotation${cardsTotal !== 1 ? 's' : ''}`
                : `${cardsItems.length} quotation${cardsItems.length !== 1 ? 's' : ''}`}
            </span>
          ) : (
            boardSearchActive && (
              <span className="bookings-search-count">
                {boardSearch.items.length} of {boardSearch.total} quotation
                {boardSearch.total !== 1 ? 's' : ''}
              </span>
            )
          )}
        </div>

        {activeView === 'board' && boardLoading && (
          <KanbanBoardLoadingPlaceholder columns={boardSkeletonColumns} />
        )}

        {activeView === 'board' && !boardLoading && (
          <div
            ref={boardRef}
            className="kanban-board"
            role="tabpanel"
            aria-label="Board"
            onPointerDown={handleBoardPointerDown}
            onPointerMove={handleBoardPointerMove}
            onPointerUp={endBoardPan}
            onPointerCancel={endBoardPan}
          >
            {renderForeignUnmatchedColumn()}
            {columns.map(renderColumn)}
            {renderAddColumnSlot()}
          </div>
        )}

        {activeView === 'cards' && (
          <div
            ref={cardsScrollRef}
            className="bookings-cards-scroll"
            role="tabpanel"
            aria-label="Cards"
          >
          <div
            ref={cardsGridRef}
            className="bookings-cards-grid"
            onDragOver={handleCardsGridDragOver}
            onDrop={handleCardsGridDrop}
          >
            {cardsLoading && cardsDisplayItems.length === 0 && (
              <p className="bookings-cards-loading text-muted small mb-0">
                Loading quotations…
              </p>
            )}
            {!cardsLoading && cardsDisplayItems.length === 0 && (
              <div className="bookings-empty-view">
                <h5 className="mb-2">
                  {isSearching ? 'No matches' : 'No quotations yet'}
                </h5>
                <p className="mb-0">
                  {isSearching
                    ? `No quotations match "${search}".`
                    : columns.length === 0
                      ? 'Add a status column on the Board to get started.'
                      : 'Use Add quotation in the toolbar.'}
                </p>
              </div>
            )}
            {(() => {
              type Entry =
                | { kind: 'card'; item: BookingItem; index: number }
                | { kind: 'placeholder'; key: string }
              const entries: Entry[] = cardsDisplayItems.map((item, index) => ({
                kind: 'card',
                item,
                index,
              }))
              if (cardsDrag) {
                const idx = Math.max(
                  0,
                  Math.min(cardsDrag.targetIndex, entries.length),
                )
                entries.splice(idx, 0, {
                  kind: 'placeholder',
                  key: `__ph-${idx}`,
                })
              }
              return entries.map((entry) => {
                if (entry.kind === 'placeholder') {
                  return (
                    <div
                      key={entry.key}
                      className="booking-card-placeholder"
                      aria-hidden="true"
                    />
                  )
                }
                const item = entry.item
                const column = bookingCardColumnForItem(item, columns)
                const usesForeignStatus = bookingUsesForeignStatus(item, columns)
                const accent =
                  usesForeignStatus && !column
                    ? '#6c757d'
                    : (column?.color ?? '#1f3a5f')
                const iconClass = bookingCardIconClass(item)
                const suppliers = quotationCardSuppliersFromFieldValues(
                  item.field_values,
                )
                const avatarSuppliers = suppliers.slice(0, 4)
                const avatarOverflow = Math.max(suppliers.length - avatarSuppliers.length, 0)
                const isDragging = cardsDrag?.itemId === item.id
                return (
                <article
                  key={item.id}
                  data-card-grid-id={item.id}
                  className={`booking-card${isDragging ? ' is-dragging' : ''}`}
                  draggable={cardsCanReorder && canMutate(item)}
                  onDragStart={(e) => handleCardDragStart(e, item, entry.index)}
                  onDragEnd={handleCardDragEnd}
                  onClick={() => void openEditItem(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openEditItem(item)
                    }
                  }}
                >
                  <div className="booking-card-head">
                    <div
                      className="booking-card-icon"
                      style={{
                        backgroundColor: hexToRgba(accent, 0.12),
                        color: accent,
                      }}
                      aria-hidden="true"
                    >
                      <i className={`bi ${iconClass}`} />
                    </div>
                    <div className="booking-card-titles">
                      <p className="booking-card-booking-id mb-1">
                        <span className="booking-card-meta-label">Quotation ID:</span>{' '}
                        {formatBookingId(item)}
                      </p>
                      <p className="booking-card-title mb-0">{item.title}</p>
                      {usesForeignStatus ? (
                        <BookingForeignStatusNote
                          item={item}
                          className="booking-card-foreign-status"
                        />
                      ) : (
                        <p className="booking-card-subtitle mb-0">
                          {(column?.title ?? 'Quotation').trim()}
                        </p>
                      )}
                      <BookingPaymentStatusPill
                        item={item}
                        className="booking-card-payment-status mt-1"
                      />
                    </div>
                    {canMutate(item) && (
                      <button
                        type="button"
                        className="booking-card-trash"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteItem(item)
                        }}
                        aria-label={`Delete ${item.title}`}
                        title="Delete quotation"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    )}
                  </div>

                  <div className="booking-card-meta">
                    <div className="booking-card-dates">
                      <p className="mb-1">
                        <span className="booking-card-meta-label">Start:</span>{' '}
                        <span className="booking-card-date booking-card-date--start">
                          {formatBookingCardDate(item.created_at)}
                        </span>
                      </p>
                      <p className="mb-0">
                        <span className="booking-card-meta-label">End:</span>{' '}
                        <span className="booking-card-date booking-card-date--end">
                          {formatBookingCardDate(item.date_of_event)}
                        </span>
                      </p>
                    </div>
                    <div className="booking-card-pricing">
                      <p className="booking-card-meta-label mb-1">Pricing</p>
                      <p className="booking-card-price mb-0">
                        {formatBookingCardTotalAmount(item, currencyFormat)}
                      </p>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="booking-card-notes mb-0">{item.notes}</p>
                  )}

                  <div className="booking-card-footer">
                    <span className="booking-card-members-count">
                      <i className="bi bi-building" />
                      {suppliers.length}{' '}
                      {suppliers.length === 1 ? 'Supplier' : 'Suppliers'}
                    </span>
                    <span className="booking-card-avatars" aria-hidden="true">
                      {avatarSuppliers.map((supplier) => (
                        <span
                          key={supplier.supplierId}
                          className="booking-card-avatar"
                        >
                          {supplier.logoUrl ? (
                            <img
                              src={supplier.logoUrl}
                              alt=""
                              className="booking-card-avatar-img"
                            />
                          ) : (
                            <i className="bi bi-building" />
                          )}
                        </span>
                      ))}
                      {avatarOverflow > 0 && (
                        <span className="booking-card-avatar booking-card-avatar--more">
                          {avatarOverflow}+
                        </span>
                      )}
                    </span>
                  </div>
                  <BookingOwnerCompanyLabel
                    item={item}
                    className="booking-card-created-by"
                  />
                </article>
                )
              })
            })()}
            {cardsHasMore && cardsDisplayItems.length > 0 && (
              <div
                ref={cardsSentinelRef}
                className="bookings-cards-sentinel"
                aria-hidden="true"
              />
            )}
            {cardsLoadingMore && (
              <p className="bookings-cards-loading-more text-muted small mb-0">
                Loading more…
              </p>
            )}
            {/* {!cardsHasMore && cardsDisplayItems.length > 0 && !cardsLoading && (
              <p className="bookings-cards-end text-muted small mb-0">
                All {cardsTotal} quotation{cardsTotal !== 1 ? 's' : ''} loaded
              </p>
            )} */}
          </div>
          </div>
        )}

        {activeView === 'list' && (
          <div className="bookings-list-card" role="tabpanel" aria-label="List">
            <div ref={listScrollRef} className="bookings-list-scroll">
              {listLoading && listItems.length === 0 ? (
                <p className="text-muted small p-3 mb-0">Loading quotations…</p>
              ) : (
              <table className="bookings-list-table">
                <thead>
                  <tr>
                    <th aria-label="Drag" />
                    <th>Quotation ID</th>
                    <th>Quotation</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Payment</th>
                    <th>Price</th>
                    <th>Date</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody
                  ref={tbodyRef}
                  onDragOver={handleTbodyDragOver}
                  onDrop={handleTbodyDrop}
                >
                  {listItems.length === 0 && !listLoading && (
                    <tr>
                      <td colSpan={9} className="bookings-list-empty">
                        {debouncedSearch.trim()
                          ? `No quotations match "${debouncedSearch}".`
                          : columns.length === 0
                            ? 'Add a status column on the Board to get started.'
                            : 'No quotations yet. Use Add quotation in the toolbar.'}
                      </td>
                    </tr>
                  )}
                  {(() => {
                    type Row =
                      | { kind: 'item'; item: BookingItem; index: number }
                      | { kind: 'placeholder'; key: string }
                    const rows: Row[] = listItems.map((item, index) => ({
                      kind: 'item',
                      item,
                      index,
                    }))
                    if (listDrag) {
                      const idx = Math.max(
                        0,
                        Math.min(listDrag.targetIndex, rows.length),
                      )
                      rows.splice(idx, 0, {
                        kind: 'placeholder',
                        key: `__ph-${idx}`,
                      })
                    }
                    return rows.map((row) => {
                      if (row.kind === 'placeholder') {
                        return (
                          <tr key={row.key} className="bookings-list-placeholder" aria-hidden="true">
                            <td colSpan={9} />
                          </tr>
                        )
                      }
                      const item = row.item
                      const column = bookingCardColumnForItem(item, columns)
                      const usesForeignStatus = bookingUsesForeignStatus(
                        item,
                        columns,
                      )
                      const isDragging = listDrag?.itemId === item.id
                      const pillColor =
                        usesForeignStatus && !column
                          ? '#6c757d'
                          : (column?.color ?? '#1f3a5f')
                      const statusLabel = usesForeignStatus
                        ? bookingForeignStatusTitle(item)
                        : (column?.title ?? '—').trim()
                      return (
                        <tr
                          key={item.id}
                          data-row-id={item.id}
                          draggable={listCanReorder && canMutate(item)}
                          onDragStart={(e) => handleRowDragStart(e, item, row.index)}
                          onDragEnd={handleRowDragEnd}
                          className={`bookings-list-row${isDragging ? ' is-dragging' : ''}`}
                        >
                          <td className="bookings-list-handle" aria-label="Drag to reorder">
                            <i className="bi bi-arrows-move" />
                          </td>
                          <td className="bookings-list-id">{formatBookingId(item)}</td>
                          <td className="bookings-list-name">
                            <div className="bookings-list-name-cell">
                              <span className="bookings-list-name-title">{item.title}</span>
                              <BookingOwnerCompanyLabel
                                item={item}
                                className="bookings-list-created-by"
                              />
                            </div>
                          </td>
                          <td className="bookings-list-status">
                            <div className="bookings-list-status-cell">
                              <span
                                className="bookings-list-pill"
                                style={{
                                  color: pillColor,
                                  borderColor: pillColor,
                                }}
                              >
                                {statusLabel}
                              </span>
                              {usesForeignStatus && (
                                <span className="bookings-list-status-note">
                                  Status from another company
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="bookings-list-notes">
                            {item.notes || '—'}
                          </td>
                          <td className="bookings-list-payment">
                            {bookingPaymentStatus(item) ? (
                              <BookingPaymentStatusPill item={item} />
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="bookings-list-price">
                            {formatBookingCardTotalAmount(item, currencyFormat)}
                          </td>
                          <td className="bookings-list-date">
                            {formatBookingCardDate(item.date_of_event)}
                          </td>
                          <td className="bookings-list-actions">
                            {canMutate(item) && (
                              <button
                                type="button"
                                className="bookings-list-action bookings-list-action--delete"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteItem(item)
                                }}
                                aria-label={`Delete ${item.title}`}
                                title="Delete"
                              >
                                <i className="bi bi-trash" />
                              </button>
                            )}
                            {bookingsRead && (
                            <button
                              type="button"
                              className="bookings-list-action bookings-list-action--edit"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditItem(item)
                              }}
                              aria-label={
                                bookingsWrite
                                  ? `Edit ${item.title}`
                                  : `View ${item.title}`
                              }
                              title={bookingsWrite ? 'Edit' : 'View'}
                            >
                              <i
                                className={
                                  bookingsWrite
                                    ? 'bi bi-pencil-square'
                                    : 'bi bi-eye'
                                }
                              />
                            </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  })()}
                  {listHasMore && listItems.length > 0 && (
                    <tr ref={listSentinelRef} className="bookings-list-sentinel">
                      <td colSpan={9} className="text-center text-muted small py-3">
                        {listLoadingMore ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                              aria-hidden="true"
                            />
                            Loading more…
                          </>
                        ) : (
                          'Scroll for more'
                        )}
                      </td>
                    </tr>
                  )}
                  {!listHasMore && listItems.length > 0 && !listLoading && (
                    <tr className="bookings-list-end">
                      <td colSpan={9} className="text-center text-muted small py-3">
                        All {listTotal} quotation{listTotal !== 1 ? 's' : ''} {listTotal !== 1 ? 'have' : 'has'} been loaded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              )}
            </div>
          </div>
        )}
      </div>

      {statusModal && statusesWrite && (
        <StatusEditModal
          form={statusModal}
          onChange={setStatusModal}
          onClose={() => setStatusModal(null)}
          onSubmit={handleStatusSubmit}
        />
      )}

      {itemModal && (
        <BookingEditModal
          form={itemModal}
          loadingDetails={itemModalLoading}
          canWrite={bookingsWrite}
          saving={itemSaving}
          statuses={columns}
          templates={templates}
          bookingGroups={modalBookingGroups ?? []}
          onChange={setItemModal}
          onDeleteGroup={
            bookingsWrite && itemModal.canEdit !== false
              ? handleDeleteBookingGroup
              : undefined
          }
          onClose={closeItemModal}
          onSubmit={handleItemSubmit}
          onPricingApplied={
            bookingsWrite && itemModal.mode === 'edit' && itemModal.id != null
              ? handlePricingApplied
              : undefined
          }
          historyRefreshKey={bookingHistoryRefresh}
          onSendToCalendar={
            itemModal.mode === 'edit' && itemModal.id != null
              ? () => void handleSendToCalendar()
              : undefined
          }
          onDuplicated={async (item) => {
            setModalBookingGroups(item.groups ?? [])
            setItemModal({
              ...bookingItemToEditForm(item),
              canEdit: canMutate(item),
            })
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.set(EDIT_PARAM, String(item.id))
                return next
              },
              { replace: true },
            )
            reloadBoardData()
            reloadCardsBookings()
            reloadListBookings()
          }}
        />
      )}

      {appointmentModal && (
        <AppointmentEditModal
          form={appointmentModal}
          contacts={appointmentContacts}
          statuses={appointmentStatuses}
          bookings={
            activeView === 'list'
              ? listItems
              : activeView === 'cards'
                ? cardsDisplayItems
                : boardFlatItems
          }
          loadingOptions={appointmentLoadingOptions}
          saving={appointmentSaving}
          error={appointmentModalError}
          onChange={setAppointmentModal}
          onClose={handleAppointmentModalClose}
          onSubmit={(e) => void handleAppointmentSubmit(e)}
        />
      )}
    </div>
  )
}

export default BookingsPage
