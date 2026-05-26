import CalendarStatusesPanel from './calendar/CalendarStatusesPanel'

const CalendarSettingsPage = () => (
  <div>
    <p className="text-muted small mb-3">
      Manage appointment status labels and colors used on the calendar.
    </p>
    <CalendarStatusesPanel />
  </div>
)

export default CalendarSettingsPage
