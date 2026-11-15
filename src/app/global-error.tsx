'use client'

import { usePathname } from 'next/navigation'
import { PageError } from '@/components/PageError'
import './globals.css'

export default function GlobalError() {
  const locale = /^\/en(?:\/|$)/.test(usePathname() ?? '') ? 'en' : 'ja'
  return <html lang={locale}><body><PageError locale={locale} /></body></html>
}
