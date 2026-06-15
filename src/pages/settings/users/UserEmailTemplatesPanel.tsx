import { historyPaths } from '../../../services/history'
import {
  createEmailUserTemplate,
  deleteEmailUserTemplate,
  fetchEmailUserTemplates,
  updateEmailUserTemplate,
} from '../../../services/emailUserTemplates'
import { EmailTemplatesPanel } from '../EmailTemplatesSettingsPage'

const UserEmailTemplatesPanel = () => (
  <EmailTemplatesPanel
    typeLabel="users"
    emptyMessage="No user email templates yet. Default templates are created for each company."
    fetchTemplates={fetchEmailUserTemplates}
    createTemplate={createEmailUserTemplate}
    updateTemplate={updateEmailUserTemplate}
    deleteTemplate={deleteEmailUserTemplate}
    historyPathForId={historyPaths.emailTemplateUsers}
  />
)

export default UserEmailTemplatesPanel
