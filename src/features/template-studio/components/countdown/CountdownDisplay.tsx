import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { formatCountdownCompact, getCountdownParts, type CountdownParts } from '../../lib/countdownDate'
import { normalizeCountdownStyle } from '../../lib/countdownStyles'
import type { CountdownStyle } from '../../types/schema'
import '../../styles/countdown.css'

type CountdownDisplayProps = {
  targetDate: string
  label: string
  style?: CountdownStyle
  pageScale?: number
}

const UNIT_LABELS = ['Days', 'Hours', 'Mins', 'Secs'] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function unitValues(parts: CountdownParts): [string, string, string, string] {
  return [
    String(parts.days),
    pad2(parts.hours),
    pad2(parts.minutes),
    pad2(parts.seconds),
  ]
}

/** Live countdown (updates every second). */
const CountdownDisplay = ({
  targetDate,
  label,
  style: styleProp,
  pageScale = 1,
}: CountdownDisplayProps) => {
  const style = normalizeCountdownStyle(styleProp)
  const [parts, setParts] = useState(() => getCountdownParts(targetDate))

  useEffect(() => {
    setParts(getCountdownParts(targetDate))
    const id = window.setInterval(() => {
      setParts(getCountdownParts(targetDate))
    }, 1000)
    return () => window.clearInterval(id)
  }, [targetDate])

  const scaleVar = { ['--countdown-scale' as string]: pageScale } as CSSProperties
  const values = unitValues(parts)
  const modifier = `countdown--${style}`

  let body: ReactNode

  switch (style) {
    case 'cards':
    case 'split':
      body = (
        <div className="countdown-units">
          {values.map((value, i) => (
            <div key={UNIT_LABELS[i]} className="countdown-unit">
              <span className="countdown-value">{value}</span>
              <span className="countdown-unit-label">{UNIT_LABELS[i]}</span>
            </div>
          ))}
        </div>
      )
      break
    case 'minimal':
      body = (
        <div className="countdown-inline countdown-inline--minimal">
          {values.join(':')}
        </div>
      )
      break
    case 'dark':
      body = (
        <>
          <div className="countdown-units countdown-units--dark">
            {values.map((value, i) => (
              <div key={UNIT_LABELS[i]} className="countdown-unit">
                <span className="countdown-value">{value}</span>
                <span className="countdown-unit-label">{UNIT_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </>
      )
      break
    case 'elegant':
      body = (
        <div className="countdown-elegant-row">
          {values.map((value, i) => (
            <span key={UNIT_LABELS[i]} className="countdown-elegant-segment">
              <span className="countdown-value">{value}</span>
              <span className="countdown-unit-label">{UNIT_LABELS[i]}</span>
              {i < values.length - 1 ? <span className="countdown-elegant-dot" aria-hidden="true">·</span> : null}
            </span>
          ))}
        </div>
      )
      break
    case 'classic':
    default:
      body = (
        <div className="countdown-inline countdown-inline--classic">
          {formatCountdownCompact(parts)}
        </div>
      )
      break
  }

  return (
    <div
      className={`countdown ${modifier} h-100 w-100`}
      style={scaleVar}
      data-expired={parts.expired || undefined}
    >
      {body}
      {label ? <div className="countdown-label">{label}</div> : null}
    </div>
  )
}

export default CountdownDisplay
