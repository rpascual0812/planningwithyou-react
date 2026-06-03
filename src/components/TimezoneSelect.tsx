import { useMemo } from 'react'
import { TIMEZONE_OPTIONS } from '../lib/timezones'
import SearchableSelect from './SearchableSelect'

type TimezoneSelectProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  hideLabel?: boolean
  labelledBy?: string
  triggerId?: string
  embedded?: boolean
  disabled?: boolean
  wrapperClassName?: string
  labelClassName?: string
}

const TimezoneSelect = ({
  value,
  onChange,
  label = 'Timezone',
  hideLabel = false,
  labelledBy,
  triggerId,
  embedded = false,
  disabled = false,
  wrapperClassName,
  labelClassName,
}: TimezoneSelectProps) => {
  const options = useMemo(
    () => TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: tz })),
    [],
  )

  return (
    <SearchableSelect
      label={label}
      hideLabel={hideLabel}
      labelledBy={labelledBy}
      triggerId={triggerId}
      embedded={embedded}
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Choose timezone…"
      searchPlaceholder="Search timezone…"
      emptyMessage="No timezones match your search"
      disabled={disabled}
      wrapperClassName={wrapperClassName}
      labelClassName={labelClassName}
    />
  )
}

export default TimezoneSelect
