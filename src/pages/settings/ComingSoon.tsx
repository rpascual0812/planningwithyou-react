type ComingSoonProps = {
  label: string
}

const ComingSoon = ({ label }: ComingSoonProps) => (
  <div className="settings-coming-soon" role="status">
    <i className="bi bi-stars" aria-hidden="true" />
    <p>
      <strong>{label}</strong> settings are coming soon.
    </p>
    <span>We&apos;re polishing this section. Check back shortly.</span>
  </div>
)

export default ComingSoon
