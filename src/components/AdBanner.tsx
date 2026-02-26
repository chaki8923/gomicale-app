'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

interface AdBannerProps {
  slot: string
  format?: 'auto' | 'horizontal' | 'rectangle'
  height?: number
}

export function AdBanner({ slot, format = 'auto', height }: AdBannerProps) {
  useEffect(() => {
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // AdSense が読み込まれていない場合は無視
    }
  }, [])

  const insStyle: React.CSSProperties = {
    display: 'block',
    ...(height ? { height: `${height}px` } : {}),
  }

  return (
    <ins
      className="adsbygoogle"
      style={insStyle}
      data-ad-client="ca-pub-6348441325859182"
      data-ad-slot={slot}
      data-ad-format={height ? undefined : format}
      {...(!height && { 'data-full-width-responsive': 'true' })}
    />
  )
}
