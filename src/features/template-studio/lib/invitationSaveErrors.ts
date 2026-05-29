import { showErrorToast } from '../../../utils/toast'

export const DUPLICATE_TITLE_TOAST_TITLE = 'Error'
export const DUPLICATE_TITLE_TOAST_TEXT = 'An invitation with this title already exists. Choose a different title.'

const DUPLICATE_TITLE_API_MESSAGE =
  'An invitation with this title already exists. Choose a different title.'

export function isDuplicateTitleError(message: string): boolean {
  return (
    message === DUPLICATE_TITLE_API_MESSAGE ||
    message.toLowerCase().includes('invitation with this title already exists')
  )
}

/** Show save validation error toast; returns true when the title field should be highlighted. */
export function notifyInvitationSaveError(message: string): boolean {
  if (isDuplicateTitleError(message)) {
    showErrorToast(DUPLICATE_TITLE_TOAST_TITLE, DUPLICATE_TITLE_TOAST_TEXT)
    return true
  }
  showErrorToast(message)
  return false
}
