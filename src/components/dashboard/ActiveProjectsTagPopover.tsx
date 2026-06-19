import DashboardTagPopover from './DashboardTagPopover'
import { saveActiveProjectsTagConfig } from '../../services/config'

type ActiveProjectsTagPopoverProps = {
  companyId: number
  selectedTagIds: number[]
  onTagSaved: () => void
}

const ActiveProjectsTagPopover = (props: ActiveProjectsTagPopoverProps) => (
  <DashboardTagPopover
    {...props}
    title="Active projects tags"
    hint="Count quotations for statuses with any selected tag."
    triggerAriaLabel="Edit active projects tags"
    dialogAriaLabel="Select active projects tags"
    saveTags={saveActiveProjectsTagConfig}
    editButtonClassName="dashboard-preview-edit dashboard-preview-edit--on-teal"
  />
)

export default ActiveProjectsTagPopover
