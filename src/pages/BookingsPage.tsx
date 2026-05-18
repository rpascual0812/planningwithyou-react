import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
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
  fetchBookingItems,
  reorderBookingItems,
  updateBookingStatus,
  updateBookingItem,
} from '../services/bookings'
import BookingEditModal, { type BookingFormState, type BookingField, clearBookingDraft } from '../components/BookingEditModal'
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
import { normalizeContactId } from '../lib/contactDisplay'
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
      booking_group_id: fv.booking_group_id ?? null,
      field_type: fieldType,
      is_required: fv.is_required,
      options: (fv.options ?? []).map((o) => ({
        label: o.label,
        price: o.price,
        sort_order: o.sort_order,
      })),
      price: stored.price,
      sort_order: fv.sort_order,
      saved: true,
      value: stored.value,
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
        value: stored.value,
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

function formatPrice(value: number): string {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}k`
  }
  return `$${value}`
}

type BookingCardDetails = {
  iconClass: string
  subtitle: string
  startDate: string
  endDate: string
  longDate: string
  shortId: string
  price: string
  progress: number
  members: number
  status: 'completed' | 'progress' | 'new'
  statusLabel: string
}

function deriveBookingCardDetails(
  item: BookingItem,
  column: BookingColumn | undefined,
  columnIndex: number,
  totalColumns: number,
): BookingCardDetails {
  const h = stableHash(String(item.id))
  const iconClass = CARD_ICONS[h % CARD_ICONS.length]
  const subtitle = (column?.title ?? 'Booking').trim()

  const startOffsetDays = (h % 180) - 60
  const durationDays = 30 + ((h >> 3) % 150)
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() + startOffsetDays)
  const end = new Date(start)
  end.setDate(start.getDate() + durationDays)

  const priceBuckets = [280, 400, 1000, 2500, 10000, 25000, 100000, 200000, 400000]
  const price = formatPrice(priceBuckets[h % priceBuckets.length])
  const members = 3 + ((h >> 5) % 35)

  const lowerTitle = (column?.title ?? '').toLowerCase()
  let status: BookingCardDetails['status']
  let statusLabel: string
  let progress: number
  if (lowerTitle.includes('complete') || lowerTitle.includes('done')) {
    status = 'completed'
    statusLabel = 'Completed'
    progress = 100
  } else if (lowerTitle.includes('new') || lowerTitle.includes('backlog')) {
    status = 'new'
    statusLabel = 'New'
    progress = Math.max(10, Math.round(((columnIndex + 1) / Math.max(totalColumns, 1)) * 40))
  } else {
    status = 'progress'
    statusLabel = 'Progress'
    progress = Math.max(
      20,
      Math.round(((columnIndex + 1) / Math.max(totalColumns, 1)) * 100) - 10,
    )
  }

  const longDate = start.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const shortId = `#${item.id}`

  return {
    iconClass,
    subtitle,
    startDate: formatYmd(start),
    endDate: formatYmd(end),
    longDate,
    shortId,
    price,
    progress,
    members,
    status,
    statusLabel,
  }
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

const MEMBER_AVATAR_COLORS = [
  '#1f3a5f',
  '#52b585',
  '#f0a830',
  '#5a8edb',
  '#d65a5a',
  '#9c6cd0',
]

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

const BookingsPage = () => {
  const [columns, setColumns] = useState<BookingColumn[]>([])
  const [items, setItems] = useState<BookingItem[]>([])
  const [templates, setTemplates] = useState<FormTemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<BookingsView>(BOOKING_VIEW_DEFAULT)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [statusModal, setStatusModal] = useState<StatusFormState | null>(null)
  const [itemModal, setItemModal] = useState<BookingFormState | null>(null)
  const suppressEditFromUrl = useRef(false)
  const [search, setSearch] = useState('')
  const isSearching = search.trim().length > 0
  const [searchParams, setSearchParams] = useSearchParams()

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

  const loadData = useCallback(async () => {
    try {
      const [cols, itms, tmpls] = await Promise.all([
        fetchBookingStatuses(),
        fetchBookingItems(),
        fetchFormTemplates(),
      ])
      setColumns(cols)
      setItems(itms)
      setTemplates(tmpls)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const matchesSearch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return () => true
    }
    return (item: BookingItem) => {
      const column = columns.find((c) => c.id === item.status)
      return [item.title, item.notes, column?.title ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    }
  }, [search, columns])

  const filteredItems = useMemo(
    () => items.filter(matchesSearch),
    [items, matchesSearch],
  )

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
    const current = cardsDrag ?? cardsDragRef.current
    if (!current) {
      return
    }
    setItems((prev) => {
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
      // Persist new order
      const updates = next.map((it, idx) => ({
        id: it.id,
        status: it.status,
        sort_order: idx,
      }))
      reorderBookingItems(updates).catch(() => {})
      return next
    })
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
    const current = listDrag ?? listDragRef.current
    if (!current) {
      return
    }
    setItems((prev) => {
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
    })
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

  const itemsByColumn = useMemo(() => {
    const map = new Map<number, BookingItem[]>()
    columns.forEach((c) => map.set(c.id, []))
    items.forEach((it) => {
      const bucket = map.get(it.status)
      if (bucket) {
        bucket.push(it)
      }
    })
    return map
  }, [items, columns])

  // --- Drag handlers -------------------------------------------------------

  const handleItemDragStart = (
    e: DragEvent<HTMLDivElement>,
    item: BookingItem,
    indexInColumn: number,
  ) => {
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
    setItems((prev) => {
      const source = prev.find((it) => it.id === itemId)
      if (!source) {
        return prev
      }

      let postMoveIndex = renderedTargetIndex
      if (source.status === targetColumnId) {
        const sourceIndexInColumn = prev
          .filter((it) => it.status === targetColumnId)
          .findIndex((it) => it.id === itemId)
        if (sourceIndexInColumn >= 0 && renderedTargetIndex > sourceIndexInColumn) {
          postMoveIndex = renderedTargetIndex - 1
        }
      }

      const without = prev.filter((it) => it.id !== itemId)
      const targetColumnItems = without.filter(
        (it) => it.status === targetColumnId,
      )
      const clamped = Math.max(
        0,
        Math.min(postMoveIndex, targetColumnItems.length),
      )

      let insertAtFlat: number
      if (clamped < targetColumnItems.length) {
        const anchor = targetColumnItems[clamped]
        insertAtFlat = without.findIndex((it) => it.id === anchor.id)
      } else if (targetColumnItems.length > 0) {
        const last = targetColumnItems[targetColumnItems.length - 1]
        insertAtFlat = without.findIndex((it) => it.id === last.id) + 1
      } else {
        insertAtFlat = without.length
      }

      const moved: BookingItem = { ...source, status: targetColumnId }
      const next = [...without]
      next.splice(insertAtFlat, 0, moved)

      // Persist: update the moved item's column + sort_order for all items in the target column
      const targetItems = next.filter((it) => it.status === targetColumnId)
      const updates = targetItems.map((it, idx) => ({
        id: it.id,
        status: targetColumnId,
        sort_order: idx,
      }))
      // If cross-column move, also update sort_order in the source column
      if (source.status !== targetColumnId) {
        const sourceItems = next.filter((it) => it.status === source.status)
        sourceItems.forEach((it, idx) => {
          updates.push({ id: it.id, status: source.status, sort_order: idx })
        })
      }
      reorderBookingItems(updates).catch(() => {})

      return next
    })
  }

  // --- Status CRUD ---------------------------------------------------------

  const openCreateStatus = () => {
    setStatusModal({
      mode: 'create',
      id: null,
      title: '',
      description: '',
      color: COLOR_SWATCHES[0],
    })
  }

  const openEditStatus = (column: BookingColumn) => {
    setStatusModal({
      mode: 'edit',
      id: column.id,
      title: column.title,
      description: column.description,
      color: column.color,
    })
  }

  const handleStatusSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!statusModal) {
      return
    }
    const title = statusModal.title.trim() || 'Untitled'
    const description = statusModal.description.trim()
    const color = statusModal.color || '#1f3a5f'

    try {
      if (statusModal.mode === 'create') {
        const created = await createBookingStatus({ title, description, color })
        setColumns((prev) => [...prev, created])
      } else if (statusModal.id) {
        const updated = await updateBookingStatus(statusModal.id, {
          title,
          description,
          color,
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
    const count = itemsByColumn.get(column.id)?.length ?? 0
    const msg =
      count > 0
        ? `Delete status "${column.title}"? Its ${count} booking${
            count === 1 ? '' : 's'
          } will also be removed.`
        : `Delete status "${column.title}"?`
    if (!window.confirm(msg)) {
      return
    }
    try {
      await deleteBookingStatus(column.id)
      setColumns((prev) => prev.filter((c) => c.id !== column.id))
      setItems((prev) => prev.filter((it) => it.status !== column.id))
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
    setItemModal(null)
    clearEditParam()
  }

  const handleDeleteBookingGroup = async (bookingId: number, groupId: number) => {
    await deleteBookingGroup(bookingId, groupId)
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== bookingId) return it
        return {
          ...it,
          groups: (it.groups ?? []).filter((g) => g.id !== groupId),
          field_values: (it.field_values ?? []).filter(
            (fv) => fv.booking_group_id !== groupId,
          ),
        }
      }),
    )
  }

  const openCreateItem = (statusId: number) => {
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
    })
  }

  const openEditItem = (item: BookingItem) => {
    let dateOfEvent = ''
    let timeOfEvent = ''
    if (item.date_of_event) {
      const d = new Date(item.date_of_event)
      dateOfEvent = formatYmd(d)
      timeOfEvent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    setItemModal({
      mode: 'edit',
      id: item.id,
      statusId: item.status,
      contactId: normalizeContactId(item.contact),
      title: item.title,
      dateOfEvent,
      timeOfEvent,
      fields: fieldValuesToFields(item),
      extraGroupNames: emptyBookingGroupNamesFromItem(
        item.field_values ?? [],
        item.groups ?? [],
      ),
      notes: item.notes,
      pdfUrl: item.pdf_url ?? '',
    })
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(EDIT_PARAM, String(item.id))
        return next
      },
      { replace: true },
    )
  }

  const handleItemSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!itemModal) {
      return
    }
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

    const unsavedFields = itemModal.fields.filter((f) => !f.saved)
    if (unsavedFields.length > 0) {
      showErrorToast('Save or remove unsaved custom fields before saving the booking.')
      return
    }

    const missingRequired = itemModal.fields.filter((f) => {
      if (!f.saved || !f.is_required) return false
      if (f.field_type === 'supplier') {
        const { tier_id, supplier_id } = parseSupplierFieldValue(f.value)
        return tier_id == null || supplier_id == null
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

    try {
      const field_values = fieldsToFieldValues(itemModal.fields)
      const groups = buildBookingGroupsPayload(
        itemModal.fields,
        itemModal.extraGroupNames ?? [],
      )
      if (itemModal.mode === 'create') {
        const created = await createBookingItem({
          status: statusId,
          contact,
          title,
          date_of_event,
          groups,
          field_values,
          notes,
        })
        setItems((prev) => [...prev, created])
      } else if (itemModal.id) {
        const updated = await updateBookingItem(itemModal.id, {
          title,
          date_of_event,
          groups,
          field_values,
          notes,
          status: statusId,
          contact,
        })
        setItems((prev) =>
          prev.map((it) => (it.id === updated.id ? updated : it)),
        )
      }
      clearBookingDraft(itemModal.id)
      showSuccessToast(
        itemModal.mode === 'create' ? 'Booking created.' : 'Booking saved.',
      )
      closeItemModal()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save booking.'
      showErrorToast(message)
    }
  }

  const handleDeleteItem = async (item: BookingItem) => {
    if (!window.confirm(`Delete card "${item.title}"?`)) {
      return
    }
    try {
      await deleteBookingItem(item.id)
      setItems((prev) => prev.filter((it) => it.id !== item.id))
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
    const item = items.find((it) => it.id === numId)
    if (!item) {
      clearEditParam()
      return
    }
    if (itemModal?.mode === 'edit' && itemModal.id === item.id) {
      return
    }
    {
      let dateOfEvent = ''
      let timeOfEvent = ''
      if (item.date_of_event) {
        const d = new Date(item.date_of_event)
        dateOfEvent = formatYmd(d)
        timeOfEvent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
      setItemModal({
        mode: 'edit',
        id: item.id,
        statusId: item.status,
        contactId: normalizeContactId(item.contact),
        title: item.title,
        dateOfEvent,
        timeOfEvent,
        fields: fieldValuesToFields(item),
        extraGroupNames: emptyBookingGroupNamesFromItem(
          item.field_values ?? [],
          item.groups ?? [],
        ),
        notes: item.notes,
        pdfUrl: item.pdf_url ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams, items, columns])

  // --- Esc / body scroll lock for modals -----------------------------------

  useEffect(() => {
    if (!statusModal && !itemModal) {
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
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
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [statusModal, itemModal])

  // --- Render --------------------------------------------------------------

  const renderColumn = (column: BookingColumn) => {
    const columnItems = (itemsByColumn.get(column.id) ?? []).filter(
      (it) => matchesSearch(it) || drag?.itemId === it.id,
    )

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

    const count = columnItems.length

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
                title={`${count} card${count === 1 ? '' : 's'}`}
              >
                {count}
              </span>
            </div>
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
          </div>
          {column.description && (
            <p className="kanban-column-description mb-0">
              {column.description}
            </p>
          )}
        </header>

        <div
          className={`kanban-column-cards${isTarget ? ' is-drop-target' : ''}`}
          ref={(el) => {
            listRefs.current.set(column.id, el)
          }}
          onDragOver={(e) => handleColumnDragOver(e, column.id)}
          onDrop={(e) => handleColumnDrop(e, column.id)}
        >
          {entries.length === 0 && (
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
                draggable={!isSearching}
                onDragStart={(e) => handleItemDragStart(e, it, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => openEditItem(it)}
              >
                <span
                  className="kanban-card-strip"
                  style={{ backgroundColor: column.color }}
                  aria-hidden="true"
                />
                <div className="kanban-card-body">
                  <p className="kanban-card-title mb-1">{it.title}</p>
                  {it.notes && (
                    <p className="kanban-card-notes mb-0">{it.notes}</p>
                  )}
                </div>
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
              </div>
            )
          })}
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
      </div>
    </section>
  )

  if (loading) {
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
            <div className="bookings-tabs" role="tablist" aria-label="Bookings views">
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
                  onClick={() => setActiveView(tab.id as BookingsView)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary bookings-add-booking-btn"
              disabled={columns.length === 0}
              title={
                columns.length === 0
                  ? 'Add a status column on the Board first'
                  : 'New booking in the first status column'
              }
              onClick={() => {
                if (columns.length > 0) openCreateItem(columns[0].id)
              }}
            >
              <i className="bi bi-plus-lg me-1" aria-hidden="true" />
              Add booking
            </button>
          </div>

          <div className="bookings-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              className="bookings-search-input"
              placeholder="Search bookings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search bookings"
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

          {isSearching && (
            <span className="bookings-search-count">
              {filteredItems.length} of {items.length} bookings
            </span>
          )}
        </div>

        {activeView === 'board' && (
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
            {columns.map(renderColumn)}
            {renderAddColumnSlot()}
          </div>
        )}

        {activeView === 'cards' && (
          <>
          <div
            ref={cardsGridRef}
            className="bookings-cards-grid"
            role="tabpanel"
            aria-label="Cards"
            onDragOver={handleCardsGridDragOver}
            onDrop={handleCardsGridDrop}
          >
            {filteredItems.length === 0 && (
              <div className="bookings-empty-view">
                <h5 className="mb-2">
                  {isSearching ? 'No matches' : 'No bookings yet'}
                </h5>
                <p className="mb-0">
                  {isSearching
                    ? `No bookings match "${search}".`
                    : columns.length === 0
                      ? 'Add a status column on the Board to get started.'
                      : 'Use Add booking in the toolbar.'}
                </p>
              </div>
            )}
            {(() => {
              type Entry =
                | { kind: 'card'; item: BookingItem; index: number }
                | { kind: 'placeholder'; key: string }
              const entries: Entry[] = filteredItems.map((item, index) => ({
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
                const columnIndex = columns.findIndex(
                  (c) => c.id === item.status,
                )
                const column =
                  columnIndex >= 0 ? columns[columnIndex] : undefined
                const details = deriveBookingCardDetails(
                  item,
                  column,
                  columnIndex,
                  columns.length,
                )
                const accent = column?.color ?? '#1f3a5f'
                const avatarCount = Math.min(details.members, 4)
                const overflow = Math.max(details.members - avatarCount, 0)
                const isDragging = cardsDrag?.itemId === item.id
                return (
                <article
                  key={item.id}
                  data-card-grid-id={item.id}
                  className={`booking-card${isDragging ? ' is-dragging' : ''}`}
                  draggable={!isSearching}
                  onDragStart={(e) => handleCardDragStart(e, item, entry.index)}
                  onDragEnd={handleCardDragEnd}
                  onClick={() => openEditItem(item)}
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
                      <i className={`bi ${details.iconClass}`} />
                    </div>
                    <div className="booking-card-titles">
                      <p className="booking-card-title mb-0">{item.title}</p>
                      <p className="booking-card-subtitle mb-0">
                        {details.subtitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="booking-card-trash"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteItem(item)
                      }}
                      aria-label={`Delete ${item.title}`}
                      title="Delete booking"
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>

                  <div className="booking-card-meta">
                    <div className="booking-card-dates">
                      <p className="mb-1">
                        <span className="booking-card-meta-label">Start:</span>{' '}
                        <span className="booking-card-date booking-card-date--start">
                          {details.startDate}
                        </span>
                      </p>
                      <p className="mb-0">
                        <span className="booking-card-meta-label">End:</span>{' '}
                        <span className="booking-card-date booking-card-date--end">
                          {details.endDate}
                        </span>
                      </p>
                    </div>
                    <div className="booking-card-pricing">
                      <p className="booking-card-meta-label mb-1">Pricing</p>
                      <p className="booking-card-price mb-0">{details.price}</p>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="booking-card-notes mb-0">{item.notes}</p>
                  )}

                  <div className="booking-card-progress-row">
                    <div
                      className="booking-card-progress"
                      role="progressbar"
                      aria-valuenow={details.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span
                        className={`booking-card-progress-fill booking-card-progress-fill--${details.status}`}
                        style={{ width: `${details.progress}%` }}
                      >
                        <span className="booking-card-progress-label">
                          {details.progress}%
                        </span>
                      </span>
                    </div>
                    <span
                      className={`booking-card-pill booking-card-pill--${details.status}`}
                    >
                      {details.statusLabel}
                    </span>
                  </div>

                  <div className="booking-card-footer">
                    <span className="booking-card-members-count">
                      <i className="bi bi-people" />
                      {details.members} Members
                    </span>
                    <span className="booking-card-avatars" aria-hidden="true">
                      {Array.from({ length: avatarCount }).map((_, i) => {
                        const color =
                          MEMBER_AVATAR_COLORS[
                            (stableHash(String(item.id)) + i) % MEMBER_AVATAR_COLORS.length
                          ]
                        return (
                          <span
                            key={i}
                            className="booking-card-avatar"
                            style={{ backgroundColor: color }}
                          />
                        )
                      })}
                      {overflow > 0 && (
                        <span className="booking-card-avatar booking-card-avatar--more">
                          {overflow}+
                        </span>
                      )}
                    </span>
                  </div>
                </article>
                )
              })
            })()}
          </div>
          </>
        )}

        {activeView === 'list' && (
          <div className="bookings-list-card" role="tabpanel" aria-label="List">
            <div className="bookings-list-scroll">
              <table className="bookings-list-table">
                <thead>
                  <tr>
                    <th aria-label="Drag" />
                    <th>Booking</th>
                    <th>Status</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>id</th>
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
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={9} className="bookings-list-empty">
                        {isSearching
                          ? `No bookings match "${search}".`
                          : columns.length === 0
                            ? 'Add a status column on the Board to get started.'
                            : 'No bookings yet. Use Add booking in the toolbar.'}
                      </td>
                    </tr>
                  )}
                  {(() => {
                    type Row =
                      | { kind: 'item'; item: BookingItem; index: number }
                      | { kind: 'placeholder'; key: string }
                    const rows: Row[] = filteredItems.map((item, index) => ({
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
                      const columnIndex = columns.findIndex(
                        (c) => c.id === item.status,
                      )
                      const column =
                        columnIndex >= 0 ? columns[columnIndex] : undefined
                      const details = deriveBookingCardDetails(
                        item,
                        column,
                        columnIndex,
                        columns.length,
                      )
                      const isDragging = listDrag?.itemId === item.id
                      const pillColor = column?.color ?? '#1f3a5f'
                      return (
                        <tr
                          key={item.id}
                          data-row-id={item.id}
                          draggable={!isSearching}
                          onDragStart={(e) => handleRowDragStart(e, item, row.index)}
                          onDragEnd={handleRowDragEnd}
                          className={`bookings-list-row${isDragging ? ' is-dragging' : ''}`}
                        >
                          <td className="bookings-list-handle" aria-label="Drag to reorder">
                            <i className="bi bi-arrows-move" />
                          </td>
                          <td className="bookings-list-name">{item.title}</td>
                          <td className="bookings-list-position">
                            {column?.title ?? '—'}
                          </td>
                          <td>
                            <span
                              className="bookings-list-pill"
                              style={{ color: pillColor, borderColor: pillColor }}
                            >
                              {details.statusLabel}
                            </span>
                          </td>
                          <td className="bookings-list-notes">
                            {item.notes || '—'}
                          </td>
                          <td className="bookings-list-id">{details.shortId}</td>
                          <td className="bookings-list-price">{details.price}</td>
                          <td className="bookings-list-date">{details.longDate}</td>
                          <td className="bookings-list-actions">
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
                            <button
                              type="button"
                              className="bookings-list-action bookings-list-action--edit"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditItem(item)
                              }}
                              aria-label={`Edit ${item.title}`}
                              title="Edit"
                            >
                              <i className="bi bi-pencil-square" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {statusModal && (
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
          statuses={columns}
          templates={templates}
          bookingGroups={
            itemModal.id != null
              ? items.find((i) => i.id === itemModal.id)?.groups ?? []
              : []
          }
          onChange={setItemModal}
          onDeleteGroup={handleDeleteBookingGroup}
          onClose={closeItemModal}
          onSubmit={handleItemSubmit}
        />
      )}
    </div>
  )
}

export default BookingsPage
