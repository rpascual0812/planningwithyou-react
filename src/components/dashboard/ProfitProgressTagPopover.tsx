import DashboardTagPopover from './DashboardTagPopover'
import { saveProfitProgressTagConfig } from '../../services/config'

type ProfitProgressTagPopoverProps = {
  companyId: number
  selectedTagId: number | null
  onTagSaved: () => void
}

const ProfitProgressTagPopover = (props: ProfitProgressTagPopoverProps) => (
  <DashboardTagPopover
    {...props}
    title="Profit tag"
    hint="Sum quotation totals for statuses with this tag."
    triggerAriaLabel="Edit profit progress tag"
    dialogAriaLabel="Select profit progress tag"
    saveTag={saveProfitProgressTagConfig}
  />
)

export default ProfitProgressTagPopover
