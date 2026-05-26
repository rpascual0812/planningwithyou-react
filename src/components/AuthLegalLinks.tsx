import { Link } from 'react-router-dom'
import { LEGAL_DOCUMENT_ROUTES } from '../services/systemLegal'

const AuthLegalLinks = () => (
  <nav
    className="auth-legal-links d-flex flex-wrap gap-3 justify-content-center"
    aria-label="Legal documents"
  >
    <Link to={LEGAL_DOCUMENT_ROUTES.privacy_policy.path} className="auth-terms">
      Privacy Policy
    </Link>
    <Link to={LEGAL_DOCUMENT_ROUTES.terms_condition.path} className="auth-terms">
      Terms &amp; Conditions
    </Link>
    <Link to={LEGAL_DOCUMENT_ROUTES.terms_use.path} className="auth-terms">
      Terms of Use
    </Link>
  </nav>
)

export default AuthLegalLinks
