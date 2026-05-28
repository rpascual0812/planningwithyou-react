import { historyPaths } from '../../../services/history'
import {
  createEmailCalendarTemplate,
  deleteEmailCalendarTemplate,
  fetchEmailCalendarTemplates,
  updateEmailCalendarTemplate,
} from '../../../services/emailCalendarTemplates'
import { EmailTemplatesPanel } from '../EmailTemplatesSettingsPage'

const CalendarEmailTemplatesPanel = () => (
  <EmailTemplatesPanel
    typeLabel="calendar"
    emptyMessage="No calendar email templates yet. Default templates are created for each company."
    fetchTemplates={fetchEmailCalendarTemplates}
    createTemplate={createEmailCalendarTemplate}
    updateTemplate={updateEmailCalendarTemplate}
    deleteTemplate={deleteEmailCalendarTemplate}
    historyPathForId={historyPaths.emailTemplateCalendar}
  />
)

export default CalendarEmailTemplatesPanel
