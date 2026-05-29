import Swal from 'sweetalert2'

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
})

export function showSuccessToast(message: string): void {
  void Toast.fire({
    icon: 'success',
    title: message,
  })
}

export function showErrorToast(title: string, text?: string): void {
  void Toast.fire({
    icon: 'error',
    title,
    ...(text ? { text } : {}),
  })
}
