import { useEffect, useState } from 'react'
import { fetchSecuredFileBlobUrl } from '../lib/securedFileUrl'
import type { UserRecord } from '../services/users'

export function getUserInitials(user: UserRecord | null | undefined): string {
  if (!user) return '?'
  const first = user.first_name?.[0] ?? ''
  const last = user.last_name?.[0] ?? ''
  if (first || last) return `${first}${last}`.toUpperCase()
  return (user.username?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
}

type UserAvatarProps = {
  user: UserRecord | null | undefined
  /** Classes on the image, or on the initials element when not wrapped. */
  className?: string
  /** Optional outer wrapper (e.g. nav-profile-avatar). */
  wrapperClassName?: string
  /** Extra classes on the initials fallback. */
  initialsClassName?: string
  alt?: string
}

/**
 * Shows the user's profile photo when available; otherwise their initials.
 */
export function UserAvatar({
  user,
  className = '',
  wrapperClassName,
  initialsClassName = '',
  alt = '',
}: UserAvatarProps) {
  const [photoUrl, setPhotoUrl] = useState('')
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
    const secured = user?.photo_url?.trim()
    if (!secured) {
      setPhotoUrl('')
      return
    }
    let objectUrl = ''
    let cancelled = false
    fetchSecuredFileBlobUrl(secured)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setPhotoUrl(url)
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl('')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [user?.photo_url])

  const showPhoto = Boolean(photoUrl) && !imageFailed

  const content = showPhoto ? (
    <img
      src={photoUrl}
      alt={alt}
      className={wrapperClassName ? undefined : className}
      onError={() => setImageFailed(true)}
    />
  ) : (
    <span
      className={
        wrapperClassName
          ? initialsClassName
          : [className, initialsClassName].filter(Boolean).join(' ')
      }
      aria-hidden={alt ? undefined : true}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
    >
      {getUserInitials(user)}
    </span>
  )

  if (wrapperClassName) {
    return <span className={wrapperClassName}>{content}</span>
  }

  return content
}
