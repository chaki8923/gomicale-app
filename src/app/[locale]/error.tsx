'use client'

import { useLocale } from 'next-intl'
import { PageError } from '@/components/PageError'

export default function ErrorPage() {
  return <PageError locale={useLocale()} />
}
