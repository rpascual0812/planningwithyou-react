import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'

import IntegrationGroupAccordion from './integrations/IntegrationGroupAccordion'

const EmailSettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const result = searchParams.get('gmail')
    if (!result) return
    const message = searchParams.get('gmail_message')
    if (result === 'connected') {
      void Swal.fire({
        icon: 'success',
        title: 'Gmail connected',
        text: 'Emails for this company will be sent from your Gmail account.',
      })
    } else {
      void Swal.fire({
        icon: 'error',
        title: 'Gmail connection failed',
        text: message || 'Please try connecting again.',
      })
    }
    const next = new URLSearchParams(searchParams)
    next.delete('gmail')
    next.delete('gmail_message')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  return (
    <div className="account-settings integrations-settings">
      <ul className="faq-list">
        <IntegrationGroupAccordion
          purpose="email"
          tourId="settings-email-integrations"
          defaultOpen
        />
      </ul>
    </div>
  )
}

export default EmailSettingsPage
