import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { MouseEvent } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateClickArg } from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import type {
  DatesSetArg,
  DayHeaderContentArg,
  EventApi,
  EventClickArg,
  EventDropArg,
  EventHoveringArg,
} from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { useSearchParams } from 'react-router-dom'

import AppointmentEditModal, {
  EMPTY_APPOINTMENT_FORM,
  type AppointmentFormState,
} from '../components/AppointmentEditModal'
import {
  appointmentPayloadFromForm,
  calendarRecordToEventInput,
  formatLocalDateTime,
  isoToDateLocalValue,
  isoToDatetimeLocalValue,
} from '../lib/calendarEventFormat'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchCalendarStatuses,
  updateCalendarEvent,
  type CalendarEventRecord,
  type CalendarStatusRecord,
  type RepeatTypeValue,
} from '../services/calendar'
import { fetchBookingItems } from '../services/bookings'
import { fetchContacts } from '../services/contacts'
import type { BookingItemRecord } from '../services/bookings'
import type { ContactRecord } from '../services/contacts'
import { showErrorToast, showSuccessToast } from '../utils/toast'

const EDIT_PARAM = 'edit'

type CalendarPageProps = {
  isSidebarCollapsed: boolean
}

type AppointmentDetails = {
  title: string
  start: string
  end: string
  contactFirstName?: string
  contactLastName?: string
  bookingTitle?: string
  textColor?: string
  backgroundColor?: string
}

type AnchorRect = {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

const GAP = 8
const VIEW_PADDING = 8
const POPOVER_ESTIMATE_W = 300
const POPOVER_ESTIMATE_H = 280
const HOVER_HIDE_DELAY_MS = 150

function formFromCalendarRecord(ev: CalendarEventRecord): AppointmentFormState {
  return {
    eventId: ev.id,
    title: ev.title,
    startValue: isoToDatetimeLocalValue(ev.start),
    endValue: isoToDatetimeLocalValue(ev.end),
    repeatType: (ev.repeat_type ?? '') as RepeatTypeValue,
    repeatEndValue: ev.repeat_end ? isoToDateLocalValue(ev.repeat_end) : '',
    contactId: ev.contact,
    statusId: ev.status,
    bookingId: ev.booking,
  }
}

function eventPatchFromApi(ev: EventApi): { start: string; end: string } | null {
  if (!ev.start) return null
  const start = ev.start.toISOString()
  const end = (ev.end ?? ev.start).toISOString()
  return { start, end }
}

function toAnchorRect(rect: DOMRectReadOnly): AnchorRect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

function computePopoverPosition(
  anchor: AnchorRect,
  popoverW: number,
  popoverH: number,
  viewportW: number,
  viewportH: number,
): { top: number; left: number } {
  const spaceBelow = viewportH - anchor.bottom - GAP - VIEW_PADDING
  const spaceAbove = anchor.top - GAP - VIEW_PADDING
  const spaceRight = viewportW - anchor.right - GAP - VIEW_PADDING
  const spaceLeft = anchor.left - GAP - VIEW_PADDING

  let top = 0
  let left = 0

  const preferBelow =
    spaceBelow >= popoverH || (spaceBelow >= spaceAbove && spaceBelow >= Math.min(spaceLeft, spaceRight))

  if (preferBelow && spaceBelow >= popoverH) {
    top = anchor.bottom + GAP
    left = anchor.left + anchor.width / 2 - popoverW / 2
  } else if (spaceAbove >= popoverH) {
    top = anchor.top - GAP - popoverH
    left = anchor.left + anchor.width / 2 - popoverW / 2
  } else if (spaceRight >= popoverW) {
    left = anchor.right + GAP
    top = anchor.top + anchor.height / 2 - popoverH / 2
  } else if (spaceLeft >= popoverW) {
    left = anchor.left - GAP - popoverW
    top = anchor.top + anchor.height / 2 - popoverH / 2
  } else {
    top = anchor.bottom + GAP
    left = anchor.left + anchor.width / 2 - popoverW / 2
  }

  left = Math.max(VIEW_PADDING, Math.min(left, viewportW - popoverW - VIEW_PADDING))
  top = Math.max(VIEW_PADDING, Math.min(top, viewportH - popoverH - VIEW_PADDING))

  return { top, left }
}

const CalendarPage = ({ isSidebarCollapsed }: CalendarPageProps) => {
  const calendarRef = useRef<FullCalendar | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const hidePopoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const employees = useMemo(() => ['Alice', 'Bob', 'Carla'], [])

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>([])
  const [statuses, setStatuses] = useState<CalendarStatusRecord[]>([])
  const [contacts, setContacts] = useState<ContactRecord[]>([])
  const [bookings, setBookings] = useState<BookingItemRecord[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const [popover, setPopover] = useState<{
    details: AppointmentDetails
    anchor: AnchorRect
    position: { top: number; left: number }
  } | null>(null)

  const [editModal, setEditModal] = useState<AppointmentFormState | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  const statusById = useMemo(
    () => new Map(statuses.map((s) => [s.id, s])),
    [statuses],
  )

  const contactById = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  )

  const bookingById = useMemo(
    () => new Map(bookings.map((b) => [b.id, b])),
    [bookings],
  )

  const fcEvents = useMemo(
    () =>
      calendarEvents.map((ev) =>
        calendarRecordToEventInput(ev, statusById, contactById, bookingById),
      ),
    [calendarEvents, statusById, contactById, bookingById],
  )

  const loadEvents = useCallback(async (start?: string, end?: string) => {
    setLoadingEvents(true)
    try {
      const rows = await fetchCalendarEvents(start, end)
      setCalendarEvents(rows)
    } catch {
      showErrorToast('Could not load calendar appointments.')
      setCalendarEvents([])
    } finally {
      setLoadingEvents(false)
    }
  }, [])

  const loadModalOptions = useCallback(async () => {
    setLoadingOptions(true)
    try {
      const [contactRows, statusRows, bookingRows] = await Promise.all([
        fetchContacts(),
        fetchCalendarStatuses(),
        fetchBookingItems(),
      ])
      setContacts(contactRows)
      const sortedStatuses = [...statusRows].sort(
        (a, b) => a.sort_order - b.sort_order || a.id - b.id,
      )
      setStatuses(sortedStatuses)
      setBookings(bookingRows)
      return sortedStatuses
    } catch {
      showErrorToast('Could not load appointment options.')
      return []
    } finally {
      setLoadingOptions(false)
    }
  }, [])

  useEffect(() => {
    void loadModalOptions()
  }, [loadModalOptions])

  useEffect(() => {
    setEditModal((prev) => {
      if (!prev || prev.eventId !== null || prev.statusId != null) return prev
      if (statuses.length === 0) return prev
      return { ...prev, statusId: statuses[0].id }
    })
  }, [statuses])

  const clearEditParam = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!next.has(EDIT_PARAM)) return prev
        next.delete(EDIT_PARAM)
        return next
      },
      { replace: true },
    )
  }

  const writeEditParam = (eventId: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(EDIT_PARAM, String(eventId))
        return next
      },
      { replace: true },
    )
  }

  const clearHidePopoverTimer = () => {
    if (hidePopoverTimerRef.current !== null) {
      window.clearTimeout(hidePopoverTimerRef.current)
      hidePopoverTimerRef.current = null
    }
  }

  const scheduleHidePopover = () => {
    clearHidePopoverTimer()
    hidePopoverTimerRef.current = window.setTimeout(() => {
      setPopover(null)
      hidePopoverTimerRef.current = null
    }, HOVER_HIDE_DELAY_MS)
  }

  useEffect(() => {
    const updateCalendarSize = () => {
      calendarRef.current?.getApi()?.updateSize()
    }
    updateCalendarSize()
    const timer = window.setTimeout(updateCalendarSize, 320)
    window.addEventListener('resize', updateCalendarSize)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', updateCalendarSize)
    }
  }, [isSidebarCollapsed])

  useEffect(() => {
    clearHidePopoverTimer()
    setPopover(null)
  }, [isSidebarCollapsed])

  useEffect(() => () => clearHidePopoverTimer(), [])

  useEffect(() => {
    const targetId = searchParams.get(EDIT_PARAM)
    if (!targetId || editModal) return
    const ev = calendarEvents.find((it) => String(it.id) === targetId)
    if (!ev) {
      clearEditParam()
      return
    }
    setEditModal(formFromCalendarRecord(ev))
    if (contacts.length === 0 || statuses.length === 0) {
      void loadModalOptions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, calendarEvents])

  useLayoutEffect(() => {
    if (!popover || !popoverRef.current) return
    const el = popoverRef.current
    const rect = el.getBoundingClientRect()
    if (rect.width < 8 || rect.height < 8) return
    const next = computePopoverPosition(
      popover.anchor,
      rect.width,
      rect.height,
      window.innerWidth,
      window.innerHeight,
    )
    setPopover((prev) => {
      if (!prev) return prev
      if (prev.position.top === next.top && prev.position.left === next.left) return prev
      return { ...prev, position: next }
    })
  }, [popover])

  useEffect(() => {
    if (!popover) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearHidePopoverTimer()
        setPopover(null)
      }
    }
    const dismissPopover = () => {
      clearHidePopoverTimer()
      setPopover(null)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', dismissPopover, true)
    window.addEventListener('resize', dismissPopover)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', dismissPopover, true)
      window.removeEventListener('resize', dismissPopover)
    }
  }, [popover])

  useEffect(() => {
    if (!editModal) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleEditModalClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [editModal])

  const handleDatesSet = (arg: DatesSetArg) => {
    void loadEvents(arg.start.toISOString(), arg.end.toISOString())
  }

  const handleDayHeaderContent = (arg: DayHeaderContentArg) => {
    if (arg.view.type !== 'employeeTimeGrid') return arg.text
    const rangeStart = arg.view.currentStart
    const msInDay = 1000 * 60 * 60 * 24
    const dayOffset = Math.floor((arg.date.getTime() - rangeStart.getTime()) / msInDay)
    return employees[dayOffset] ?? `Employee ${dayOffset + 1}`
  }

  const openPopoverForEvent = (arg: EventHoveringArg) => {
    clearHidePopoverTimer()
    const { event, el } = arg
    const start = event.start
      ? event.start.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : 'N/A'
    const end = event.end
      ? event.end.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : 'N/A'
    const props = event.extendedProps as {
      statusTextColor?: string
      statusBackgroundColor?: string
      contactFirstName?: string
      contactLastName?: string
      bookingTitle?: string
    }
    const anchor = toAnchorRect(el.getBoundingClientRect())
    setPopover({
      details: {
        title: event.title,
        start,
        end,
        contactFirstName: props.contactFirstName,
        contactLastName: props.contactLastName,
        bookingTitle: props.bookingTitle,
        textColor: props.statusTextColor,
        backgroundColor: props.statusBackgroundColor,
      },
      anchor,
      position: computePopoverPosition(
        anchor,
        POPOVER_ESTIMATE_W,
        POPOVER_ESTIMATE_H,
        window.innerWidth,
        window.innerHeight,
      ),
    })
  }

  const handleEventMouseEnter = (arg: EventHoveringArg) => openPopoverForEvent(arg)

  const handleEventMouseLeave = (arg: EventHoveringArg) => {
    const related = arg.jsEvent.relatedTarget as Node | null
    if (related && popoverRef.current?.contains(related)) return
    scheduleHidePopover()
  }

  const handlePopoverMouseEnter = () => clearHidePopoverTimer()

  const handlePopoverMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as Node | null
    if (related && (related as Element).closest?.('.fc-event')) return
    scheduleHidePopover()
  }

  const dismissPopoverImmediately = () => {
    clearHidePopoverTimer()
    setPopover(null)
  }

  const openCreateModal = (start: Date, end?: Date) => {
    dismissPopoverImmediately()
    setModalError(null)
    const defaultStatusId = statuses[0]?.id ?? null
    const endDate = end ?? new Date(start.getTime() + 60 * 60 * 1000)
    setEditModal({
      ...EMPTY_APPOINTMENT_FORM,
      startValue: formatLocalDateTime(start),
      endValue: formatLocalDateTime(endDate),
      statusId: defaultStatusId,
    })
    if (contacts.length === 0 || statuses.length === 0) {
      void loadModalOptions()
    }
  }

  const handleDateClick = (arg: DateClickArg) => {
    void openCreateModal(arg.date)
  }

  const handleAddAppointmentClick = () => {
    void openCreateModal(new Date())
  }

  const handleEventClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault()
    dismissPopoverImmediately()
    const eventId = Number(info.event.id)
    if (!eventId) return
    const record = calendarEvents.find((e) => e.id === eventId)
    if (!record) return
    setModalError(null)
    setEditModal(formFromCalendarRecord(record))
    writeEditParam(eventId)
    if (contacts.length === 0 || statuses.length === 0) {
      void loadModalOptions()
    }
  }

  const persistEventTimes = async (
    ev: EventApi,
    revert: () => void,
  ) => {
    const id = Number(ev.id)
    const patch = eventPatchFromApi(ev)
    if (!id || !patch) return
    try {
      const updated = await updateCalendarEvent(id, patch)
      setCalendarEvents((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch {
      showErrorToast('Could not update appointment time.')
      revert()
    }
  }

  const handleEventDrop = (info: EventDropArg) => {
    dismissPopoverImmediately()
    void persistEventTimes(info.event, () => info.revert())
  }

  const handleEventResize = (info: EventResizeDoneArg) => {
    dismissPopoverImmediately()
    void persistEventTimes(info.event, () => info.revert())
  }

  const handleEditModalClose = () => {
    setEditModal(null)
    setModalError(null)
    clearEditParam()
  }

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editModal) return

    const startMs = new Date(editModal.startValue).getTime()
    const endMs = new Date(editModal.endValue).getTime()
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
      setModalError('End must be on or after start.')
      return
    }

    setSaving(true)
    setModalError(null)
    try {
      const payload = appointmentPayloadFromForm(editModal)
      if (editModal.eventId === null) {
        const created = await createCalendarEvent(payload)
        setCalendarEvents((prev) => [...prev, created])
        showSuccessToast('Appointment created.')
      } else {
        const updated = await updateCalendarEvent(editModal.eventId, payload)
        setCalendarEvents((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        )
        showSuccessToast('Appointment updated.')
      }
      handleEditModalClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed'
      setModalError(message)
      showErrorToast(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editModal?.eventId) return
    if (!window.confirm(`Delete "${editModal.title || 'this appointment'}"?`)) return
    setDeleting(true)
    setModalError(null)
    try {
      await deleteCalendarEvent(editModal.eventId)
      setCalendarEvents((prev) => prev.filter((e) => e.id !== editModal.eventId))
      showSuccessToast('Appointment deleted.')
      handleEditModalClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed'
      setModalError(message)
      showErrorToast(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="app-content calendar-page">
      <div className="container-fluid">
        <div className="calendar-page-toolbar">
          <button
            type="button"
            className="btn btn-primary calendar-page-add-btn"
            onClick={handleAddAppointmentClick}
          >
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Add appointment
          </button>
        </div>
        <div className={`calendar-surface${loadingEvents ? ' calendar-surface--loading' : ''}`}>
          {loadingEvents && (
            <div className="calendar-surface__loading" aria-live="polite" aria-busy="true">
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Loading appointments</span>
              </div>
              <span>Loading appointments…</span>
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            buttonText={{
              today: 'Today',
              month: 'Month',
              week: 'Week',
              day: 'Day',
            }}
            views={{
              dayGridMonth: {
                titleFormat: { year: 'numeric', month: 'long' },
              },
              timeGridWeek: {
                titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
              },
              timeGridDay: {
                titleFormat: {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                },
              },
            }}
            dayHeaderFormat={{ weekday: 'short' }}
            slotLabelFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
            }}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
            }}
            nowIndicator
            expandRows
            dayMaxEvents={4}
            moreLinkClick="popover"
            allDaySlot={false}
            height="auto"
            events={fcEvents}
            editable
            eventStartEditable
            eventDurationEditable
            eventResizableFromStart
            eventClassNames="calendar-fc-event"
            dayHeaderContent={handleDayHeaderContent}
            eventMouseEnter={handleEventMouseEnter}
            eventMouseLeave={handleEventMouseLeave}
            eventClick={handleEventClick}
            eventDragStart={dismissPopoverImmediately}
            eventResizeStart={dismissPopoverImmediately}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            dateClick={handleDateClick}
            datesSet={handleDatesSet}
          />
        </div>
      </div>

      {popover && (
        <div
          ref={popoverRef}
          className="appointment-popover"
          style={{ top: popover.position.top, left: popover.position.left }}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        >
          <div
            className="card shadow-sm"
            role="status"
            aria-label="Appointment details"
          >
            <div
              className="card-body"
              style={{
                ...(popover.details.backgroundColor
                  ? { backgroundColor: popover.details.backgroundColor }
                  : {}),
                ...(popover.details.textColor ? { color: popover.details.textColor } : {}),
              }}
            >
              <p className="mb-2">
                <strong>Title:</strong> {popover.details.title}
              </p>
              {(popover.details.contactFirstName || popover.details.contactLastName) && (
                <p className="mb-2">
                  <strong>Contact:</strong>{' '}
                  {[popover.details.contactFirstName, popover.details.contactLastName]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              )}
              {popover.details.bookingTitle && (
                <p className="mb-2">
                  <strong>Booking:</strong> {popover.details.bookingTitle}
                </p>
              )}
              <p className="mb-2">
                <strong>Start:</strong> {popover.details.start}
              </p>
              <p className="mb-0">
                <strong>End:</strong> {popover.details.end}
              </p>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <AppointmentEditModal
          form={editModal}
          contacts={contacts}
          statuses={statuses}
          bookings={bookings}
          loadingOptions={loadingOptions}
          saving={saving}
          deleting={deleting}
          error={modalError}
          onChange={setEditModal}
          onClose={handleEditModalClose}
          onSubmit={(e) => void handleEditSubmit(e)}
          onDelete={() => void handleDelete()}
        />
      )}
    </div>
  )
}

export default CalendarPage
