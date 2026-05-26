import { useAuthSession } from '../context/AuthSessionContext'
import { showCompanyFilter } from '../lib/companySelection'
import type { CompanyRecord } from '../services/companies'

type CompanyFilterSelectProps = {
  id: string
  label?: string
  companies: CompanyRecord[]
  loading?: boolean
  value: number | null
  onChange: (companyId: number | null) => void
  className?: string
  selectClassName?: string
}

const CompanyFilterSelect = ({
  id,
  label = 'Company',
  companies,
  loading = false,
  value,
  onChange,
  className = 'col-sm-8 col-md-4',
  selectClassName = 'form-select form-select-sm',
}: CompanyFilterSelectProps) => {
  const { currentUser } = useAuthSession()
  const showFilter = showCompanyFilter(currentUser, companies)

  if (!showFilter) {
    return null
  }

  return (
    <div className={className}>
      <label className="form-label mb-1" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={selectClassName}
        value={value ?? ''}
        disabled={loading || companies.length === 0}
        onChange={(e) => {
          const raw = e.target.value
          onChange(raw === '' ? null : Number(raw))
        }}
      >
        {companies.length === 0 ? (
          <option value="">No active companies</option>
        ) : (
          companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
              {company.is_main ? ' (main)' : ''}
            </option>
          ))
        )}
      </select>
    </div>
  )
}

export default CompanyFilterSelect
