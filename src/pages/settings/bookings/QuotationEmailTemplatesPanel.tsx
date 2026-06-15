import { historyPaths } from '../../../services/history'
import {
  createEmailBookingTemplate,
  deleteEmailBookingTemplate,
  fetchEmailBookingTemplates,
  updateEmailBookingTemplate,
} from '../../../services/emailBookingTemplates'
import { EmailTemplatesPanel } from '../EmailTemplatesSettingsPage'

const QuotationEmailTemplatesPanel = () => (
  <EmailTemplatesPanel
    typeLabel="quotations"
    emptyMessage="No quotation email templates yet. Default templates are created for each company."
    fetchTemplates={fetchEmailBookingTemplates}
    createTemplate={createEmailBookingTemplate}
    updateTemplate={updateEmailBookingTemplate}
    deleteTemplate={deleteEmailBookingTemplate}
    historyPathForId={historyPaths.emailTemplateBookings}
  />
)

export default QuotationEmailTemplatesPanel
