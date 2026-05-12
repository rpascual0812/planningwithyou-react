import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { MouseEvent } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateClickArg } from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import type {
  DayHeaderContentArg,
  EventApi,
  EventClickArg,
  EventDropArg,
  EventHoveringArg,
  EventInput,
} from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { useSearchParams } from 'react-router-dom'

/** URL query param key used to deep-link / restore the appointment edit modal. */
const EDIT_PARAM = 'edit'

/**
 * Reverse of `eventInputFromModalForm` – converts a stored event back into the
 * form fields used by the appointment edit modal. Used when hydrating the
 * modal from a `?edit=<eventId>` query param on page load.
 */
function formFromEventInput(ev: EventInput): AppointmentModalForm {
  const title = String(ev.title ?? '')
  const rawDate = (ev as { date?: string }).date
  const rawStart = typeof ev.start === 'string' ? ev.start : undefined
  const rawEnd = typeof ev.end === 'string' ? ev.end : undefined

  const allDay =
    ev.allDay === true ||
    typeof rawDate === 'string' ||
    (rawStart !== undefined && !rawStart.includes('T'))

  if (allDay) {
    const startYmd = rawDate ?? rawStart ?? formatLocalDate(new Date())
    let endYmd = rawDate ?? startYmd
    if (!rawDate && rawEnd) {
      // FC stores all-day end as exclusive; convert back to inclusive for the form.
      const [y, m, d] = rawEnd.split('-').map(Number)
      const inclusive = new Date(y, m - 1, d - 1)
      endYmd = formatLocalDate(inclusive)
    }
    return { title, startValue: startYmd, endValue: endYmd, allDay: true }
  }

  let endValue = rawEnd ?? rawStart ?? ''
  if (rawStart && !rawEnd) {
    const startDate = new Date(rawStart)
    if (!Number.isNaN(startDate.getTime())) {
      const endGuess = new Date(startDate)
      endGuess.setHours(endGuess.getHours() + 1)
      endValue = formatLocalDateTime(endGuess)
    }
  }

  return {
    title,
    startValue: rawStart ?? '',
    endValue,
    allDay: false,
  }
}

type CalendarPageProps = {
  isSidebarCollapsed: boolean
}

type AppointmentDetails = {
  title: string
  start: string
  end: string
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
/** Used before first layout measure; refined in useLayoutEffect. */
const POPOVER_ESTIMATE_W = 300
const POPOVER_ESTIMATE_H = 200
/** Delay before hiding so the pointer can move from the event into the popover. */
const HOVER_HIDE_DELAY_MS = 150

const INITIAL_EVENTS: EventInput[] = [
  {
    id: '1',
    title: 'Alice - Client Call',
    start: '2026-05-12T09:00:00',
    end: '2026-05-12T10:00:00',
  },
  {
    id: '2',
    title: 'Bob - Design Review',
    start: '2026-05-13T10:30:00',
    end: '2026-05-13T12:00:00',
  },
  {
    id: '3',
    title: 'Carla - Sprint Planning',
    start: '2026-05-14T13:00:00',
    end: '2026-05-14T14:30:00',
  },
  {
    id: '4',
    title: 'Team Sync',
    date: '2026-05-14',
  },
  {
    id: '5',
    title: 'Release Window',
    date: '2026-05-18',
  },
]

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatLocalDateTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${formatLocalDate(d)}T${h}:${min}`
}

/** Inclusive calendar end date → FullCalendar exclusive end (day after last included day). */
function addOneDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  return formatLocalDate(dt)
}

type AppointmentModalForm = {
  title: string
  startValue: string
  endValue: string
  allDay: boolean
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Build an EventInput patch from a live FullCalendar event after a drag or resize.
 * Normalises all-day events to YMD strings (with FC's exclusive end) and timed
 * events to local datetime strings so the stored shape stays consistent.
 */
function eventInputFromEventApi(ev: EventApi): EventInput {
  const id = String(ev.id)
  const title = ev.title

  if (ev.allDay) {
    if (!ev.start) {
      return { id, title, allDay: true }
    }
    const startYmd = formatLocalDate(ev.start)
    if (!ev.end) {
      return { id, title, allDay: true, start: startYmd, end: undefined }
    }
    const spansMultipleDays = ev.end.getTime() - ev.start.getTime() > MS_PER_DAY
    if (!spansMultipleDays) {
      return { id, title, allDay: true, start: startYmd, end: undefined }
    }
    return {
      id,
      title,
      allDay: true,
      start: startYmd,
      end: formatLocalDate(ev.end),
    }
  }

  return {
    id,
    title,
    allDay: false,
    start: ev.start ? formatLocalDateTime(ev.start) : undefined,
    end: ev.end ? formatLocalDateTime(ev.end) : undefined,
  }
}

function eventInputFromModalForm(id: string, form: AppointmentModalForm): EventInput {
  const title = form.title.trim() || 'Untitled'
  if (form.allDay) {
    const startYmd = form.startValue
    const inclusiveEnd = form.endValue || form.startValue
    if (!startYmd) {
      return { id, title, allDay: true, start: formatLocalDate(new Date()) }
    }
    if (inclusiveEnd === startYmd) {
      return { id, title, allDay: true, start: startYmd, end: undefined }
    }
    return { id, title, allDay: true, start: startYmd, end: addOneDayYmd(inclusiveEnd) }
  }
  return {
    id,
    title,
    allDay: false,
    start: form.startValue,
    end: form.endValue || form.startValue,
  }
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

  left = Math.max(
    VIEW_PADDING,
    Math.min(left, viewportW - popoverW - VIEW_PADDING),
  )
  top = Math.max(
    VIEW_PADDING,
    Math.min(top, viewportH - popoverH - VIEW_PADDING),
  )

  return { top, left }
}

const CalendarPage = ({ isSidebarCollapsed }: CalendarPageProps) => {
  const calendarRef = useRef<FullCalendar | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const hidePopoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const employees = useMemo(() => ['Alice', 'Bob', 'Carla'], [])
  const [popover, setPopover] = useState<{
    details: AppointmentDetails
    anchor: AnchorRect
    position: { top: number; left: number }
  } | null>(null)

  const [events, setEvents] = useState<EventInput[]>(INITIAL_EVENTS)

  const [editModal, setEditModal] = useState<
    | ({
        eventId: string | null
      } & AppointmentModalForm)
    | null
  >(null)

  const [searchParams, setSearchParams] = useSearchParams()

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

  /** Write the event id into `?edit=<id>` so the modal survives a refresh. */
  const writeEditParam = (eventId: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(EDIT_PARAM, eventId)
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
    setEditModal(null)
  }, [isSidebarCollapsed])

  useEffect(() => {
    return () => clearHidePopoverTimer()
  }, [])

  /**
   * Reopen the appointment edit modal if the URL carries a matching
   * `?edit=<eventId>`. Lets the edit state survive a hard refresh and
   * makes the URL shareable as a deep-link into an event.
   */
  useEffect(() => {
    const targetId = searchParams.get(EDIT_PARAM)
    if (!targetId) {
      return
    }
    const ev = events.find((it) => String(it.id) === targetId)
    if (!ev) {
      clearEditParam()
      return
    }
    const form = formFromEventInput(ev)
    if (
      editModal &&
      editModal.eventId === targetId &&
      editModal.title === form.title &&
      editModal.startValue === form.startValue &&
      editModal.endValue === form.endValue &&
      editModal.allDay === form.allDay
    ) {
      return
    }
    setEditModal({ eventId: targetId, ...form })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, events])

  useLayoutEffect(() => {
    if (!popover || !popoverRef.current) {
      return
    }

    const el = popoverRef.current
    const rect = el.getBoundingClientRect()
    if (rect.width < 8 || rect.height < 8) {
      return
    }

    const next = computePopoverPosition(
      popover.anchor,
      rect.width,
      rect.height,
      window.innerWidth,
      window.innerHeight,
    )

    setPopover((prev) => {
      if (!prev) {
        return prev
      }
      if (prev.position.top === next.top && prev.position.left === next.left) {
        return prev
      }
      return { ...prev, position: next }
    })
  }, [popover])

  useEffect(() => {
    if (!popover) {
      return
    }

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

  const handleDayHeaderContent = (arg: DayHeaderContentArg) => {
    if (arg.view.type !== 'employeeTimeGrid') {
      return arg.text
    }

    const rangeStart = arg.view.currentStart

    const msInDay = 1000 * 60 * 60 * 24
    const dayOffset = Math.floor((arg.date.getTime() - rangeStart.getTime()) / msInDay)
    const employeeName = employees[dayOffset] ?? `Employee ${dayOffset + 1}`
    return employeeName
  }

  const openPopoverForEvent = (arg: EventHoveringArg) => {
    clearHidePopoverTimer()
    const { event, el } = arg
    const start = event.start
      ? event.start.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'N/A'
    const end = event.end
      ? event.end.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'N/A'

    const anchorRect = el.getBoundingClientRect()
    const anchor = toAnchorRect(anchorRect)
    const vw = window.innerWidth
    const vh = window.innerHeight
    const position = computePopoverPosition(
      anchor,
      POPOVER_ESTIMATE_W,
      POPOVER_ESTIMATE_H,
      vw,
      vh,
    )

    setPopover({
      details: {
        title: event.title,
        start,
        end,
      },
      anchor,
      position,
    })
  }

  const handleEventMouseEnter = (arg: EventHoveringArg) => {
    openPopoverForEvent(arg)
  }

  const handleEventMouseLeave = (arg: EventHoveringArg) => {
    const related = arg.jsEvent.relatedTarget as Node | null
    if (related && popoverRef.current?.contains(related)) {
      return
    }
    scheduleHidePopover()
  }

  const handlePopoverMouseEnter = () => {
    clearHidePopoverTimer()
  }

  const handlePopoverMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as Node | null
    if (related && (related as Element).closest?.('.fc-event')) {
      return
    }
    scheduleHidePopover()
  }

  useEffect(() => {
    if (!editModal) {
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditModal(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [editModal])

  const handleEventClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault()
    clearHidePopoverTimer()
    setPopover(null)

    const ev = info.event
    const eventId = ev.id
    if (!eventId) {
      return
    }

    const allDay = ev.allDay
    let startValue = ''
    let endValue = ''

    if (allDay) {
      if (ev.start) {
        startValue = formatLocalDate(ev.start)
      }
      if (ev.end) {
        const inclusiveEnd = new Date(ev.end.getTime() - 24 * 60 * 60 * 1000)
        endValue = formatLocalDate(inclusiveEnd)
      } else if (ev.start) {
        endValue = formatLocalDate(ev.start)
      }
    } else {
      if (ev.start) {
        startValue = formatLocalDateTime(ev.start)
      }
      if (ev.end) {
        endValue = formatLocalDateTime(ev.end)
      } else if (ev.start) {
        const endGuess = new Date(ev.start)
        endGuess.setHours(endGuess.getHours() + 1)
        endValue = formatLocalDateTime(endGuess)
      }
    }

    setEditModal({
      eventId,
      title: ev.title,
      startValue,
      endValue,
      allDay,
    })
    // Persist the open modal in the URL so a refresh restores it.
    writeEditParam(eventId)
  }

  const handleDateClick = (arg: DateClickArg) => {
    clearHidePopoverTimer()
    setPopover(null)

    const d = arg.date
    const allDay = arg.allDay

    if (allDay) {
      const day = formatLocalDate(d)
      setEditModal({
        eventId: null,
        title: '',
        startValue: day,
        endValue: day,
        allDay: true,
      })
      return
    }

    const endGuess = new Date(d)
    endGuess.setHours(endGuess.getHours() + 1)
    setEditModal({
      eventId: null,
      title: '',
      startValue: formatLocalDateTime(d),
      endValue: formatLocalDateTime(endGuess),
      allDay: false,
    })
  }

  const applyEventChangeFromApi = (ev: EventApi) => {
    const updated = eventInputFromEventApi(ev)
    setEvents((prev) =>
      prev.map((item) => {
        if (String(item.id) !== String(ev.id)) {
          return item
        }
        // Drop any pre-existing `date` shorthand so the new start/end win cleanly.
        const { date: _ignoredDate, ...rest } = item as EventInput & { date?: string }
        return { ...rest, ...updated }
      }),
    )
  }

  /**
   * Pop-up and popover state must vanish the moment the user begins a drag or
   * resize – otherwise the popover (or its pending hide timer) can sit on top
   * of the bottom resize handle and swallow the next pointerdown.
   */
  const dismissPopoverImmediately = () => {
    clearHidePopoverTimer()
    setPopover(null)
  }

  const handleEventDrop = (info: EventDropArg) => {
    dismissPopoverImmediately()
    applyEventChangeFromApi(info.event)
  }

  const handleEventResize = (info: EventResizeDoneArg) => {
    dismissPopoverImmediately()
    applyEventChangeFromApi(info.event)
  }

  const handleEditModalClose = () => {
    setEditModal(null)
    clearEditParam()
  }

  const handleEditSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editModal) {
      return
    }

    const form: AppointmentModalForm = {
      title: editModal.title,
      startValue: editModal.startValue,
      endValue: editModal.endValue,
      allDay: editModal.allDay,
    }

    if (editModal.eventId === null) {
      const newId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `evt-${Date.now()}`
      setEvents((prev) => [...prev, eventInputFromModalForm(newId, form)])
      setEditModal(null)
      clearEditParam()
      return
    }

    setEvents((prev) =>
      prev.map((item) => {
        if (String(item.id) !== editModal.eventId) {
          return item
        }
        const updated = eventInputFromModalForm(String(item.id), form)
        return { ...item, ...updated }
      }),
    )

    setEditModal(null)
    clearEditParam()
  }

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="calendar-surface">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            allDaySlot={false}
            height="auto"
            events={events}
            editable={true}
            eventStartEditable={true}
            eventDurationEditable={true}
            eventResizableFromStart={true}
            dayHeaderContent={handleDayHeaderContent}
            eventMouseEnter={handleEventMouseEnter}
            eventMouseLeave={handleEventMouseLeave}
            eventClick={handleEventClick}
            eventDragStart={dismissPopoverImmediately}
            eventResizeStart={dismissPopoverImmediately}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            dateClick={handleDateClick}
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
          <div className="card shadow-sm" role="status" aria-label="Appointment details">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Appointment Details</h5>
            </div>
            <div className="card-body">
              <p className="mb-2">
                <strong>Title:</strong> {popover.details.title}
              </p>
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
        <>
          <div
            className="appointment-edit-modal-backdrop modal-backdrop fade show"
            aria-hidden="true"
            onClick={handleEditModalClose}
          />
          <div
            className="appointment-edit-modal modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointmentEditModalTitle"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <form onSubmit={handleEditSubmit}>
                  <div className="modal-header">
                    <h1 id="appointmentEditModalTitle" className="modal-title fs-5">
                      Edit appointment
                    </h1>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={handleEditModalClose}
                    />
                  </div>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label htmlFor="appointment-title" className="form-label">
                        Title
                      </label>
                      <input
                        id="appointment-title"
                        type="text"
                        className="form-control"
                        value={editModal.title}
                        onChange={(e) => setEditModal({ ...editModal, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-check mb-3">
                      <input
                        id="appointment-allday"
                        type="checkbox"
                        className="form-check-input"
                        checked={editModal.allDay}
                        onChange={(e) => setEditModal({ ...editModal, allDay: e.target.checked })}
                      />
                      <label className="form-check-label" htmlFor="appointment-allday">
                        All day
                      </label>
                    </div>
                    {editModal.allDay ? (
                      <>
                        <div className="mb-3">
                          <label htmlFor="appointment-start-date" className="form-label">
                            Start date
                          </label>
                          <input
                            id="appointment-start-date"
                            type="date"
                            className="form-control"
                            value={editModal.startValue}
                            onChange={(e) =>
                              setEditModal({ ...editModal, startValue: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="mb-0">
                          <label htmlFor="appointment-end-date" className="form-label">
                            End date (inclusive)
                          </label>
                          <input
                            id="appointment-end-date"
                            type="date"
                            className="form-control"
                            value={editModal.endValue}
                            onChange={(e) =>
                              setEditModal({ ...editModal, endValue: e.target.value })
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-3">
                          <label htmlFor="appointment-start" className="form-label">
                            Start
                          </label>
                          <input
                            id="appointment-start"
                            type="datetime-local"
                            className="form-control"
                            value={editModal.startValue}
                            onChange={(e) =>
                              setEditModal({ ...editModal, startValue: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="mb-0">
                          <label htmlFor="appointment-end" className="form-label">
                            End
                          </label>
                          <input
                            id="appointment-end"
                            type="datetime-local"
                            className="form-control"
                            value={editModal.endValue}
                            onChange={(e) =>
                              setEditModal({ ...editModal, endValue: e.target.value })
                            }
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={handleEditModalClose}>
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
      )}
    </div>
  )
}

export default CalendarPage
