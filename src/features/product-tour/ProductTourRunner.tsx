import { useEffect, useRef } from 'react'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useNavigate } from 'react-router-dom'
import { useAuthSession } from '../../context/AuthSessionContext'
import { completeProductTour } from '../../services/users'
import {
  buildProductTourSteps,
  shouldRunProductTour,
  type TourStepMeta,
} from './tourSteps'
import './product-tour.css'

const MOBILE_MEDIA_QUERY = '(max-width: 991.98px)'
const START_DELAY_MS = 800

type ProductTourRunnerProps = {
  onEnsureSidebarOpen?: () => void
}

const ProductTourRunner = ({ onEnsureSidebarOpen }: ProductTourRunnerProps) => {
  const { currentUser, userLoading, syncAuthState } = useAuthSession()
  const navigate = useNavigate()
  const metaRef = useRef<TourStepMeta[]>([])
  const navigateRef = useRef(navigate)
  const onEnsureSidebarOpenRef = useRef(onEnsureSidebarOpen)
  const syncAuthStateRef = useRef(syncAuthState)
  const bootIdRef = useRef(0)
  const unmountingRef = useRef(false)
  const tourEngagedRef = useRef(false)
  const driverRef = useRef<Driver | null>(null)
  const finishingRef = useRef(false)

  navigateRef.current = navigate
  onEnsureSidebarOpenRef.current = onEnsureSidebarOpen
  syncAuthStateRef.current = syncAuthState

  const currentUserRef = useRef(currentUser)
  currentUserRef.current = currentUser

  const userId = currentUser?.id
  const tourCompletedAt = currentUser?.tour_completed_at ?? null

  useEffect(() => {
    if (userLoading || !userId || tourCompletedAt) return

    const user = currentUserRef.current
    if (!user || !shouldRunProductTour(user)) return

    const meta = buildProductTourSteps(user)
    if (meta.length === 0) return

    metaRef.current = meta
    unmountingRef.current = false
    tourEngagedRef.current = false
    finishingRef.current = false

    const prepareStep = async (index: number) => {
      const stepMeta = metaRef.current[index]
      if (!stepMeta) return

      if (stepMeta.path) {
        navigateRef.current(stepMeta.path)
      }

      if (
        stepMeta.element.includes('nav-') &&
        typeof window !== 'undefined' &&
        window.matchMedia(MOBILE_MEDIA_QUERY).matches
      ) {
        onEnsureSidebarOpenRef.current?.()
      }

      const selector = stepMeta.element
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const el = document.querySelector(selector)
        if (el) {
          await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => resolve())
          })
          return
        }
        await new Promise((r) => window.setTimeout(r, 100))
      }
    }

    const finishTour = async () => {
      if (finishingRef.current) return
      finishingRef.current = true
      try {
        await completeProductTour()
        syncAuthStateRef.current()
      } catch {
        finishingRef.current = false
      }
    }

    const bootId = ++bootIdRef.current
    const steps: DriveStep[] = meta.map((m) => ({
      element: m.element,
      popover: {
        title: m.title,
        description: m.description,
        side: m.popoverSide ?? 'bottom',
        align: m.popoverAlign ?? 'start',
      },
    }))

    const driverObj = driver({
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Finish',
      allowClose: true,
      overlayOpacity: 0.55,
      popoverClass: 'product-tour-popover',
      smoothScroll: true,
      steps,
      onHighlightStarted: () => {
        tourEngagedRef.current = true
      },
      onNextClick: (_element, _step, { state }) => {
        const drv = driverRef.current
        if (!drv) return
        const nextIndex = (state.activeIndex ?? 0) + 1
        if (nextIndex >= metaRef.current.length) {
          drv.destroy()
          return
        }
        void prepareStep(nextIndex).then(() => {
          drv.moveTo(nextIndex)
        })
      },
      onPrevClick: (_element, _step, { state }) => {
        const drv = driverRef.current
        if (!drv) return
        const prevIndex = (state.activeIndex ?? 0) - 1
        if (prevIndex < 0) return
        void prepareStep(prevIndex).then(() => {
          drv.moveTo(prevIndex)
        })
      },
      onCloseClick: () => {
        driverObj.destroy()
      },
      onDestroyed: () => {
        if (unmountingRef.current) return
        if (!tourEngagedRef.current) return
        void finishTour()
      },
    })

    driverRef.current = driverObj

    const timer = window.setTimeout(() => {
      if (bootIdRef.current !== bootId || unmountingRef.current) return
      void prepareStep(0).then(() => {
        if (bootIdRef.current !== bootId || unmountingRef.current) return
        driverObj.drive(0)
      })
    }, START_DELAY_MS)

    return () => {
      unmountingRef.current = true
      window.clearTimeout(timer)
      if (driverRef.current === driverObj) {
        driverObj.destroy()
        driverRef.current = null
      }
    }
    // Narrow deps only — do not include `currentUser` (new object each fetch).
  }, [userLoading, userId, tourCompletedAt])

  return null
}

export default ProductTourRunner
