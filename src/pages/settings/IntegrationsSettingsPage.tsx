import IntegrationGroupAccordion from './integrations/IntegrationGroupAccordion'
import type { IntegrationPurpose } from './integrations/integrationData'

/** Shown via Settings ?tab=connection (nav entry hidden). Email lives under Email Settings. */
const INTEGRATIONS_PAGE_GROUPS: IntegrationPurpose[] = ['messaging']

const IntegrationsSettingsPage = () => (
  <div className="account-settings integrations-settings">
    <ul className="faq-list">
      {INTEGRATIONS_PAGE_GROUPS.map((purpose) => (
        <IntegrationGroupAccordion
          key={purpose}
          purpose={purpose}
          tourId={`settings-integrations-${purpose}`}
          defaultOpen
        />
      ))}
    </ul>
  </div>
)

export default IntegrationsSettingsPage
