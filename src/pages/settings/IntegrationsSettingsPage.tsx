import IntegrationGroupAccordion from './integrations/IntegrationGroupAccordion'
import type { IntegrationPurpose } from './integrations/integrationData'

/** Shown via Settings ?tab=connection (nav entry hidden). Calendar lives under Calendar Settings. */
const INTEGRATIONS_PAGE_GROUPS: IntegrationPurpose[] = ['email', 'messaging']

const IntegrationsSettingsPage = () => (
  <div className="account-settings integrations-settings">
    <ul className="faq-list">
      {INTEGRATIONS_PAGE_GROUPS.map((purpose, index) => (
        <IntegrationGroupAccordion
          key={purpose}
          purpose={purpose}
          tourId={`settings-integrations-${purpose}`}
          defaultOpen={index === 0}
        />
      ))}
    </ul>
  </div>
)

export default IntegrationsSettingsPage
