import type { CSSProperties } from 'react'

import type { AnimationConfig } from '../types/schema'

export type EntranceKind = 'fade' | 'slide-up' | 'slide-down' | 'zoom'

export function isEntranceAnimation(
  entrance: string | undefined,
): entrance is EntranceKind {
  return (
    entrance === 'fade'
    || entrance === 'slide-up'
    || entrance === 'slide-down'
    || entrance === 'zoom'
  )
}

export type EntranceAnimationAttrs = {
  className: string
  'data-inv-entrance'?: EntranceKind
  style?: CSSProperties
}

export function entranceAnimationAttrs(
  animation: AnimationConfig | undefined,
  inView: boolean,
): EntranceAnimationAttrs {
  const entrance = animation?.entrance
  if (!isEntranceAnimation(entrance)) {
    return { className: '' }
  }

  const style: CSSProperties = {}
  if (animation.delayMs != null && animation.delayMs > 0) {
    style.animationDelay = `${animation.delayMs}ms`
  }
  if (animation.durationMs != null && animation.durationMs > 0) {
    style.animationDuration = `${animation.durationMs}ms`
  }

  return {
    className: inView ? ' inv-animate-in-view' : '',
    'data-inv-entrance': entrance,
    style: Object.keys(style).length > 0 ? style : undefined,
  }
}
