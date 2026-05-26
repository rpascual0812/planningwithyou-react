/** Props for inputs/selects when the user has read-only access. */
export function readOnlyControlProps(readOnly: boolean) {
  return readOnly ? ({ readOnly: true, disabled: true } as const) : {}
}
