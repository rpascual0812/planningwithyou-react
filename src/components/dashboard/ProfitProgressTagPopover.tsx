import DashboardTagPopover from './DashboardTagPopover'
import { saveProfitProgressTagConfig } from '../../services/config'

type ProfitProgressTagPopoverProps = {
  companyId: number
  selectedTagIds: number[]
  onTagSaved: () => void
}

const ProfitProgressTagPopover = (props: ProfitProgressTagPopoverProps) => (
  <DashboardTagPopover
    {...props}
    title="Profit tags"
    hint="Sum quotation totals for statuses with any selected tag."
    triggerAriaLabel="Edit profit progress tags"
    dialogAriaLabel="Select profit progress tags"
    saveTags={saveProfitProgressTagConfig}
  />
)

export default ProfitProgressTagPopover
