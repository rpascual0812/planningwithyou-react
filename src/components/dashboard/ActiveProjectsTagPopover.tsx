import DashboardTagPopover from './DashboardTagPopover'
import { saveActiveProjectsTagConfig } from '../../services/config'

type ActiveProjectsTagPopoverProps = {
  companyId: number
  selectedTagId: number | null
  onTagSaved: () => void
}

const ActiveProjectsTagPopover = (props: ActiveProjectsTagPopoverProps) => (
  <DashboardTagPopover
    {...props}
    title="Active projects tag"
    hint="Count bookings for statuses with this tag."
    triggerAriaLabel="Edit active projects tag"
    dialogAriaLabel="Select active projects tag"
    saveTag={saveActiveProjectsTagConfig}
    editButtonClassName="dashboard-preview-edit dashboard-preview-edit--on-teal"
  />
)

export default ActiveProjectsTagPopover
