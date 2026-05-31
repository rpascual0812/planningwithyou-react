import { useState } from 'react'
import IntegrationGroupContent from './IntegrationGroupContent'
import { type IntegrationPurpose, groupMetaFor } from './integrationData'

type IntegrationGroupAccordionProps = {
  purpose: IntegrationPurpose
  tourId?: string
  defaultOpen?: boolean
}

const IntegrationGroupAccordion = ({
  purpose,
  tourId,
  defaultOpen = false,
}: IntegrationGroupAccordionProps) => {
  const [open, setOpen] = useState(defaultOpen)
  const group = groupMetaFor(purpose)

  return (
    <li className={`faq-item${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="faq-toggle"
        data-tour={tourId}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="faq-icon" aria-hidden="true">
          <i className={`bi ${group.iconClass}`} />
        </span>
        <span className="faq-question">{group.title}</span>
        <span className="faq-chevron" aria-hidden="true">
          <i className="bi bi-chevron-down" />
        </span>
      </button>
      {open && (
        <div className="faq-answer faq-answer--view">
          <IntegrationGroupContent purpose={purpose} />
        </div>
      )}
    </li>
  )
}

export default IntegrationGroupAccordion
