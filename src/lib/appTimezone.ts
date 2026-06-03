/** App-wide active company timezone (set from auth / company filter). */
let activeAppTimeZone: string | undefined

export function setActiveAppTimeZone(timeZone: string | undefined): void {
  activeAppTimeZone = timeZone?.trim() || undefined
}

export function getActiveAppTimeZone(): string | undefined {
  return activeAppTimeZone
}
