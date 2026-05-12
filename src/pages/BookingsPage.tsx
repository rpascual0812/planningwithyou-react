import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

type BookingItem = {
  id: string
  columnId: string
  title: string
  notes: string
}

type BookingColumn = {
  id: string
  title: string
  description: string
  color: string
  wipLimit: number | null
}

type DragState = {
  itemId: string
  sourceColumnId: string
  targetColumnId: string
  /**
   * Position the drop placeholder should occupy in the target column's
   * *currently rendered* item list (source card included). Using a "rendered
   * position" rather than a post-move index keeps the source card in the DOM
   * during the drag so the browser doesn't abort the gesture.
   */
  targetIndex: number
}

type ColumnFormState = {
  mode: 'create' | 'edit'
  id: string | null
  title: string
  description: string
  color: string
  /** Kept as a string while editing so the empty state means "no limit". */
  wipLimit: string
}

type ItemFormState = {
  mode: 'create' | 'edit'
  id: string | null
  columnId: string
  title: string
  notes: string
}

type BookingsView = 'board' | 'cards' | 'list'

/** URL query param key used to deep-link / restore an open edit modal. */
const EDIT_PARAM = 'edit'

const COLOR_SWATCHES = [
  '#1f3a5f',
  '#52b585',
  '#f0a830',
  '#5a8edb',
  '#d65a5a',
  '#9c6cd0',
  '#3a9870',
  '#152741',
]

const DEFAULT_COLUMNS: BookingColumn[] = [
  {
    id: 'col-new',
    title: 'New',
    description: 'Recently submitted bookings awaiting review.',
    color: '#1f3a5f',
    wipLimit: null,
  },
  {
    id: 'col-confirmed',
    title: 'Confirmed',
    description: 'Customer has confirmed date and scope.',
    color: '#52b585',
    wipLimit: null,
  },
  {
    id: 'col-in-progress',
    title: 'In progress',
    description: 'Work is currently being delivered.',
    color: '#f0a830',
    wipLimit: 5,
  },
  {
    id: 'col-completed',
    title: 'Completed',
    description: 'Successfully completed bookings.',
    color: '#5a8edb',
    wipLimit: null,
  },
]

const DEFAULT_ITEMS: BookingItem[] = [
  {
    id: 'itm-1',
    columnId: 'col-new',
    title: 'Alice — Curtain consult',
    notes: 'Wants Roman blinds in master bedroom.',
  },
  {
    id: 'itm-2',
    columnId: 'col-new',
    title: 'Acme Inc — Office shades',
    notes: 'Suite 4B, 12 windows total.',
  },
  {
    id: 'itm-3',
    columnId: 'col-confirmed',
    title: 'Bob Smith — Measure',
    notes: 'Confirmed for Tue 3pm.',
  },
  {
    id: 'itm-4',
    columnId: 'col-in-progress',
    title: 'Carla — Installation',
    notes: 'Awaiting fabric delivery (ETA Mon).',
  },
  {
    id: 'itm-5',
    columnId: 'col-completed',
    title: 'Dan — Final payment',
    notes: 'Paid in full on May 9.',
  },
]

const STORAGE_KEY_COLUMNS = 'pwy.bookings.columns.v1'
const STORAGE_KEY_ITEMS = 'pwy.bookings.items.v1'

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
  const h = stableHash(item.id)

  const iconClass = CARD_ICONS[h % CARD_ICONS.length]

  const subtitle = (column?.title ?? 'Booking').trim()

  // Deterministic start date roughly within the last/next ~90 days, plus a
  // duration of 30–180 days. Just enough variety to look real.
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
  const shortId = `#${100 + (h % 900)}`

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

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initial
    }
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // ignore quota / serialisation errors
    }
  }, [key, state])
  return [state, setState] as const
}

/**
 * Compute the placeholder index inside a column's card list given a drag-over
 * event. The index is relative to the *currently rendered* cards (the source
 * card is intentionally included so it remains visible during the drag), so
 * the placeholder slot can sit immediately before/after the source as well.
 */
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
  const [columns, setColumns] = useLocalStorageState<BookingColumn[]>(
    STORAGE_KEY_COLUMNS,
    DEFAULT_COLUMNS,
  )
  const [items, setItems] = useLocalStorageState<BookingItem[]>(
    STORAGE_KEY_ITEMS,
    DEFAULT_ITEMS,
  )
  const [activeView, setActiveView] = useState<BookingsView>('board')
  const [drag, setDrag] = useState<DragState | null>(null)
  const [columnModal, setColumnModal] = useState<ColumnFormState | null>(null)
  const [itemModal, setItemModal] = useState<ItemFormState | null>(null)
  const [search, setSearch] = useState('')
  const isSearching = search.trim().length > 0
  const [searchParams, setSearchParams] = useSearchParams()

  // Item matcher used by every tab so the same search query filters Board,
  // Cards, and List consistently.
  const matchesSearch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return () => true
    }
    return (item: BookingItem) => {
      const column = columns.find((c) => c.id === item.columnId)
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

  const listRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  /**
   * Synchronous mirror of `drag` so handlers fired in the same task as
   * `dragstart` (e.g. an early `dragover`) can read the current drag even
   * before the React state update has flushed.
   */
  const dragRef = useRef<DragState | null>(null)

  // --- Cards grid drag-reorder --------------------------------------------
  type CardsDragState = { itemId: string; targetIndex: number }
  const [cardsDrag, setCardsDrag] = useState<CardsDragState | null>(null)
  const cardsDragRef = useRef<CardsDragState | null>(null)
  const cardsGridRef = useRef<HTMLDivElement | null>(null)

  const handleCardDragStart = (
    e: DragEvent<HTMLElement>,
    item: BookingItem,
    sourceIndex: number,
  ) => {
    // Bail out if the drag started on an action button (trash) so trashing
    // a card never accidentally starts a reorder.
    const target = e.target as HTMLElement
    if (target.closest('button, [data-no-drag]')) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', item.id)
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

  /**
   * Compute the insertion slot in a wrapping grid by reading order.
   * - Insert before any card whose top edge is below the cursor.
   * - Insert before any card on the same row whose horizontal midpoint is
   *   to the right of the cursor.
   * - Otherwise append at the end.
   */
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
  type ListDragState = { itemId: string; targetIndex: number }
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
      e.dataTransfer.setData('text/plain', item.id)
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
      return next
    })
    listDragRef.current = null
    setListDrag(null)
  }

  const handleRowDragEnd = () => {
    listDragRef.current = null
    setListDrag(null)
  }

  // --- Board pan (click-drag the empty area to scroll horizontally) --------
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
    // Only pan when the press starts on the empty board background – never
    // when it starts on a column, card, or any of their interactive children.
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
      // Some browsers throw when capturing a pointer that's already lost.
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
        // ignore – capture may already be released
      }
    }
    panRef.current.active = false
    panRef.current.pointerId = -1
    // Swallow the click that would otherwise fire on pointerup if we actually
    // moved – prevents the column-area `onClick` from triggering when the
    // user was really just panning.
    const dx = Math.abs(e.clientX - panRef.current.startX)
    if (dx > 4) {
      e.preventDefault()
    }
  }

  const itemsByColumn = useMemo(() => {
    const map = new Map<string, BookingItem[]>()
    columns.forEach((c) => map.set(c.id, []))
    items.forEach((it) => {
      const bucket = map.get(it.columnId)
      if (bucket) {
        bucket.push(it)
      }
    })
    return map
  }, [items, columns])

  // --- Drag handlers ---------------------------------------------------------

  const handleItemDragStart = (
    e: DragEvent<HTMLDivElement>,
    item: BookingItem,
    indexInColumn: number,
  ) => {
    // 1. Configure the drag synchronously: some browsers won't actually
    //    start the drag unless the dataTransfer is touched during dragstart.
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', item.id)
    } catch {
      // Older browsers can throw on setData when called too late; safe to skip.
    }

    const initial: DragState = {
      itemId: item.id,
      sourceColumnId: item.columnId,
      targetColumnId: item.columnId,
      targetIndex: indexInColumn,
    }

    // 2. Make the drag immediately visible to any handler that runs in the
    //    same task (e.g. an early dragover) without forcing React to render.
    dragRef.current = initial

    // 3. Defer the React state update by one task. If we re-rendered the
    //    source column synchronously (inserting a placeholder, shifting the
    //    dragged card), the browser would interpret the source's mid-task
    //    movement as a cancelled drag and silently abort the gesture.
    window.setTimeout(() => {
      // Skip the update if the drag was already finished/cancelled in the
      // same task – otherwise the state would get stuck on an old drag.
      if (dragRef.current === initial) {
        setDrag(initial)
      }
    }, 0)
  }

  const handleColumnDragOver = (
    e: DragEvent<HTMLDivElement>,
    columnId: string,
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
    columnId: string,
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
    itemId: string,
    targetColumnId: string,
    /** Placeholder position in the rendered list (source card included). */
    renderedTargetIndex: number,
  ) => {
    setItems((prev) => {
      const source = prev.find((it) => it.id === itemId)
      if (!source) {
        return prev
      }

      // Convert the rendered placeholder index (which counts the source card)
      // into the index used by the post-move target-column list (which does
      // not). When moving within the same column, every slot below the source
      // shifts up by one once it's removed.
      let postMoveIndex = renderedTargetIndex
      if (source.columnId === targetColumnId) {
        const sourceIndexInColumn = prev
          .filter((it) => it.columnId === targetColumnId)
          .findIndex((it) => it.id === itemId)
        if (sourceIndexInColumn >= 0 && renderedTargetIndex > sourceIndexInColumn) {
          postMoveIndex = renderedTargetIndex - 1
        }
      }

      const without = prev.filter((it) => it.id !== itemId)
      const targetColumnItems = without.filter(
        (it) => it.columnId === targetColumnId,
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

      const moved: BookingItem = { ...source, columnId: targetColumnId }
      const next = [...without]
      next.splice(insertAtFlat, 0, moved)
      return next
    })
  }

  // --- Column CRUD -----------------------------------------------------------

  const openCreateColumn = () => {
    setColumnModal({
      mode: 'create',
      id: null,
      title: '',
      description: '',
      color: COLOR_SWATCHES[0],
      wipLimit: '',
    })
  }

  const openEditColumn = (column: BookingColumn) => {
    setColumnModal({
      mode: 'edit',
      id: column.id,
      title: column.title,
      description: column.description,
      color: column.color,
      wipLimit: column.wipLimit !== null ? String(column.wipLimit) : '',
    })
  }

  const handleColumnSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!columnModal) {
      return
    }
    const title = columnModal.title.trim() || 'Untitled'
    const description = columnModal.description.trim()
    const color = columnModal.color || '#1f3a5f'
    const trimmedLimit = columnModal.wipLimit.trim()
    let wipLimit: number | null = null
    if (trimmedLimit) {
      const parsed = parseInt(trimmedLimit, 10)
      wipLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : null
    }

    if (columnModal.mode === 'create') {
      const newCol: BookingColumn = {
        id: makeId('col'),
        title,
        description,
        color,
        wipLimit,
      }
      setColumns((prev) => [...prev, newCol])
    } else if (columnModal.id) {
      const id = columnModal.id
      setColumns((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, title, description, color, wipLimit } : c,
        ),
      )
    }
    setColumnModal(null)
  }

  const handleDeleteColumn = (column: BookingColumn) => {
    const count = itemsByColumn.get(column.id)?.length ?? 0
    const msg =
      count > 0
        ? `Delete column "${column.title}"? Its ${count} card${
            count === 1 ? '' : 's'
          } will also be removed.`
        : `Delete column "${column.title}"?`
    if (!window.confirm(msg)) {
      return
    }
    setColumns((prev) => prev.filter((c) => c.id !== column.id))
    setItems((prev) => prev.filter((it) => it.columnId !== column.id))
  }

  // --- Item CRUD -------------------------------------------------------------

  /**
   * Remove the deep-link query param without affecting any other params
   * that might exist on the route.
   */
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
    setItemModal(null)
    clearEditParam()
  }

  const openCreateItem = (columnId: string) => {
    setItemModal({
      mode: 'create',
      id: null,
      columnId,
      title: '',
      notes: '',
    })
  }

  const openEditItem = (item: BookingItem) => {
    setItemModal({
      mode: 'edit',
      id: item.id,
      columnId: item.columnId,
      title: item.title,
      notes: item.notes,
    })
    // Persist the open modal in the URL so a refresh restores it.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(EDIT_PARAM, item.id)
        return next
      },
      { replace: true },
    )
  }

  const handleItemSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!itemModal) {
      return
    }
    const title = itemModal.title.trim() || 'Untitled'
    const notes = itemModal.notes
    const columnId = itemModal.columnId

    if (itemModal.mode === 'create') {
      const newItem: BookingItem = {
        id: makeId('itm'),
        columnId,
        title,
        notes,
      }
      setItems((prev) => [...prev, newItem])
    } else if (itemModal.id) {
      const id = itemModal.id
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, title, notes, columnId } : it,
        ),
      )
    }
    closeItemModal()
  }

  const handleDeleteItem = (item: BookingItem) => {
    if (!window.confirm(`Delete card "${item.title}"?`)) {
      return
    }
    setItems((prev) => prev.filter((it) => it.id !== item.id))
    // If the deleted card was the one we were editing, also close the modal
    // and drop the param so a refresh doesn't try to reopen it.
    if (itemModal?.id === item.id) {
      closeItemModal()
    } else if (searchParams.get(EDIT_PARAM) === item.id) {
      clearEditParam()
    }
  }

  // --- Restore edit modal from URL ------------------------------------------

  /**
   * Reopen an item's edit modal if the URL carries a matching `?edit=<id>`.
   * This makes the edit state survive a hard refresh and lets the URL be
   * shared as a deep-link straight into a card.
   *
   * Runs whenever `items`, `columns`, or the param changes so we can:
   *   - hydrate once items load,
   *   - update the in-flight `itemModal` when the underlying card mutates,
   *   - drop the param if the referenced id is no longer present.
   */
  useEffect(() => {
    const targetId = searchParams.get(EDIT_PARAM)
    if (!targetId) {
      return
    }
    const item = items.find((it) => it.id === targetId)
    if (!item) {
      // Card was deleted or never existed; clean the URL silently.
      clearEditParam()
      return
    }
    // Skip if the modal is already showing this card with the same values.
    if (
      itemModal &&
      itemModal.mode === 'edit' &&
      itemModal.id === item.id &&
      itemModal.columnId === item.columnId &&
      itemModal.title === item.title &&
      itemModal.notes === item.notes
    ) {
      return
    }
    setItemModal({
      mode: 'edit',
      id: item.id,
      columnId: item.columnId,
      title: item.title,
      notes: item.notes,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items, columns])

  // --- Esc / body scroll lock for modals -------------------------------------

  useEffect(() => {
    if (!columnModal && !itemModal) {
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setColumnModal(null)
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
  }, [columnModal, itemModal])

  // --- Render ----------------------------------------------------------------

  const renderColumn = (column: BookingColumn) => {
    // While dragging, keep the source visible even if it doesn't match
    // the current search so the drag gesture has a stable element.
    const columnItems = (itemsByColumn.get(column.id) ?? []).filter(
      (it) => matchesSearch(it) || drag?.itemId === it.id,
    )

    /*
     * Build the entries to render for this column.
     * - Always render every real card (including the source while it's being
     *   dragged) so the browser keeps tracking the original drag element.
     *   The source card is just visually faded via `.kanban-card--dragging`.
     * - When this column is the drag target, insert a placeholder at the
     *   rendered slot the card would drop into.
     */
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
    const limitExceeded = column.wipLimit !== null && count > column.wipLimit
    const limitReached = column.wipLimit !== null && count >= column.wipLimit

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
                className={`kanban-column-count badge${
                  limitExceeded
                    ? ' text-bg-danger'
                    : limitReached
                      ? ' text-bg-warning'
                      : ' text-bg-light'
                }`}
                title={
                  column.wipLimit !== null
                    ? `${count} of ${column.wipLimit} (WIP limit)`
                    : `${count} card${count === 1 ? '' : 's'}`
                }
              >
                {column.wipLimit !== null ? `${count} / ${column.wipLimit}` : count}
              </span>
            </div>
            <div className="kanban-column-actions">
              <button
                type="button"
                className="btn btn-sm btn-link p-1"
                onClick={() => openEditColumn(column)}
                aria-label={`Edit column ${column.title}`}
                title="Edit column"
              >
                <i className="bi bi-pencil-square" />
              </button>
              <button
                type="button"
                className="btn btn-sm btn-link p-1 text-danger"
                onClick={() => handleDeleteColumn(column)}
                aria-label={`Delete column ${column.title}`}
                title="Delete column"
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

        <button
          type="button"
          className="kanban-add-card"
          onClick={() => openCreateItem(column.id)}
        >
          <i className="bi bi-plus-lg me-1" />
          Add card
        </button>
      </section>
    )
  }

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="bookings-toolbar-row">
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
          <>
            <div className="bookings-toolbar">
              <p className="bookings-toolbar-hint mb-0">
                Drag any card between columns — a preview shows exactly where it
                will land. Tap a card to edit details.
              </p>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={openCreateColumn}
              >
                <i className="bi bi-plus-lg me-1" />
                Add column
              </button>
            </div>

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
            </div>
          </>
        )}

        {activeView === 'cards' && (
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
                    : 'Switch back to Board to add cards.'}
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
                  (c) => c.id === item.columnId,
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
                            (stableHash(item.id) + i) % MEMBER_AVATAR_COLORS.length
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
        )}

        {activeView === 'list' && (
          <div className="bookings-list-card" role="tabpanel" aria-label="List">
            <header className="bookings-list-head">
              <h6 className="mb-0">Drag And Drop Table</h6>
            </header>
            <div className="bookings-list-scroll">
              <table className="bookings-list-table">
                <thead>
                  <tr>
                    <th aria-label="Drag" />
                    <th>Booking</th>
                    <th>Column</th>
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
                          : 'No bookings yet. Add one from the Board tab.'}
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
                        (c) => c.id === item.columnId,
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

      {columnModal && (
        <ColumnEditModal
          form={columnModal}
          onChange={setColumnModal}
          onClose={() => setColumnModal(null)}
          onSubmit={handleColumnSubmit}
        />
      )}

      {itemModal && (
        <ItemEditModal
          form={itemModal}
          columns={columns}
          onChange={setItemModal}
          onClose={closeItemModal}
          onSubmit={handleItemSubmit}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

type ColumnEditModalProps = {
  form: ColumnFormState
  onChange: (next: ColumnFormState) => void
  onClose: () => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

const ColumnEditModal = ({
  form,
  onChange,
  onClose,
  onSubmit,
}: ColumnEditModalProps) => {
  return (
    <>
      <div
        className="appointment-edit-modal-backdrop modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="appointment-edit-modal modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="columnEditTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={onSubmit}>
              <div className="modal-header">
                <h1 id="columnEditTitle" className="modal-title fs-5">
                  {form.mode === 'create' ? 'New column' : 'Edit column'}
                </h1>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label htmlFor="column-title" className="form-label">
                    Title
                  </label>
                  <input
                    id="column-title"
                    type="text"
                    className="form-control"
                    value={form.title}
                    onChange={(e) =>
                      onChange({ ...form, title: e.target.value })
                    }
                    required
                    autoFocus
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="column-description" className="form-label">
                    Description
                  </label>
                  <textarea
                    id="column-description"
                    className="form-control"
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      onChange({ ...form, description: e.target.value })
                    }
                    placeholder="What does this column represent?"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label d-block">Color</label>
                  <div className="kanban-color-swatches" role="radiogroup">
                    {COLOR_SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={form.color === c}
                        aria-label={`Color ${c}`}
                        className={`kanban-color-swatch${
                          form.color === c ? ' is-selected' : ''
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => onChange({ ...form, color: c })}
                      />
                    ))}
                    <input
                      type="color"
                      className="kanban-color-input"
                      value={form.color}
                      onChange={(e) =>
                        onChange({ ...form, color: e.target.value })
                      }
                      aria-label="Custom color"
                      title="Custom color"
                    />
                  </div>
                </div>
                <div className="mb-0">
                  <label htmlFor="column-wip" className="form-label">
                    WIP limit{' '}
                    <span className="text-muted">(optional)</span>
                  </label>
                  <input
                    id="column-wip"
                    type="number"
                    min={1}
                    step={1}
                    className="form-control"
                    value={form.wipLimit}
                    onChange={(e) =>
                      onChange({ ...form, wipLimit: e.target.value })
                    }
                    placeholder="No limit"
                  />
                </div>
              </div>
              <div className="modal-footer">
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
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

type ItemEditModalProps = {
  form: ItemFormState
  columns: BookingColumn[]
  onChange: (next: ItemFormState) => void
  onClose: () => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

const ItemEditModal = ({
  form,
  columns,
  onChange,
  onClose,
  onSubmit,
}: ItemEditModalProps) => {
  return (
    <>
      <div
        className="appointment-edit-modal-backdrop modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="appointment-edit-modal modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="itemEditTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={onSubmit}>
              <div className="modal-header">
                <h1 id="itemEditTitle" className="modal-title fs-5">
                  {form.mode === 'create' ? 'New booking' : 'Edit booking'}
                </h1>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label htmlFor="item-title" className="form-label">
                    Title
                  </label>
                  <input
                    id="item-title"
                    type="text"
                    className="form-control"
                    value={form.title}
                    onChange={(e) =>
                      onChange({ ...form, title: e.target.value })
                    }
                    required
                    autoFocus
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="item-notes" className="form-label">
                    Notes
                  </label>
                  <textarea
                    id="item-notes"
                    className="form-control"
                    rows={3}
                    value={form.notes}
                    onChange={(e) =>
                      onChange({ ...form, notes: e.target.value })
                    }
                  />
                </div>
                <div className="mb-0">
                  <label htmlFor="item-column" className="form-label">
                    Column
                  </label>
                  <select
                    id="item-column"
                    className="form-select"
                    value={form.columnId}
                    onChange={(e) =>
                      onChange({ ...form, columnId: e.target.value })
                    }
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
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
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

export default BookingsPage
