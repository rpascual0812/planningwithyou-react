type InvitationsLabelProps = {
  className?: string
  /** When true, only the Beta badge is shown (e.g. collapsed sidebar). */
  badgeOnly?: boolean
}

const InvitationsLabel = ({ className = '', badgeOnly = false }: InvitationsLabelProps) => {
  if (badgeOnly) {
    return <span className={`invitations-beta-badge ${className}`.trim()}>Beta</span>
  }

  return (
    <span className={`invitations-label ${className}`.trim()}>
      Invitations
      <span className="invitations-beta-badge">Beta</span>
    </span>
  )
}

export default InvitationsLabel
