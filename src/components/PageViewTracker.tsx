'use client'

import { useEffect, useRef } from 'react'
import { useLocale } from 'next-intl'

type PageViewTrackerProps = {
  path: string
}

export function PageViewTracker({ path }: PageViewTrackerProps) {
  const locale = useLocale()
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true

    const payload = JSON.stringify({ path, locale })
    const url = '/api/page-views'

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon(url, blob)
      return
    }

    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    })
  }, [path, locale])

  return null
}
