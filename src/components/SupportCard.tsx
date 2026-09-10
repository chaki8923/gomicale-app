'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { DEFAULT_SUPPORT_AMOUNT, type RevenueEventName, type SupportSource } from '@/lib/support'

const DISMISS_KEY = 'gomicale:support-dismissed-until'
const DISMISS_DAYS = 30

type SupportCardProps = {
  source: Exclude<SupportSource, 'donate_page'>
  milestoneKey: string
  jobId?: string
}

export function SupportCard({ source, milestoneKey, jobId }: SupportCardProps) {
  const t = useTranslations('support')
  const locale = useLocale()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const reportEvent = useCallback((eventName: RevenueEventName) => {
    void fetch('/api/support/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        source,
        jobId,
        milestoneKey,
        amount: DEFAULT_SUPPORT_AMOUNT,
      }),
      keepalive: true,
    }).catch(() => undefined)
  }, [jobId, milestoneKey, source])

  useEffect(() => {
    const dismissedUntil = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0)
    if (dismissedUntil > Date.now()) return

    setVisible(true)
    reportEvent('support_cta_impression')
  }, [reportEvent])

  async function handleSupport() {
    setLoading(true)
    setError(false)
    reportEvent('support_cta_click')

    try {
      const response = await fetch('/api/donate/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: DEFAULT_SUPPORT_AMOUNT,
          source,
          jobId,
          locale,
        }),
      })
      const data = await response.json() as { url?: string }
      if (!response.ok || !data.url) throw new Error('Checkout failed')
      window.location.assign(data.url)
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  function handleDismiss() {
    const dismissedUntil = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    window.localStorage.setItem(DISMISS_KEY, String(dismissedUntil))
    reportEvent('support_cta_dismissed')
    setVisible(false)
  }

  if (!visible) return null

  const isJob = source === 'job_completed'

  return (
    <aside className="relative overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-white to-teal-50 p-5 shadow-sm">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t('dismiss')}
        className="absolute right-3 top-3 rounded-full p-1 text-gray-400 transition hover:bg-white hover:text-gray-600"
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className="pr-7">
        <p className="mb-1 text-base font-bold text-gray-900">
          {isJob ? t('cta.jobTitle') : t('cta.classificationTitle')}
        </p>
        <p className="text-sm leading-relaxed text-gray-600">
          {isJob ? t('cta.jobDescription') : t('cta.classificationDescription')}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleSupport}
          disabled={loading}
          className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-teal-600 disabled:bg-teal-300"
        >
          {loading ? t('processing') : t('supportDefault', { amount: DEFAULT_SUPPORT_AMOUNT })}
        </button>
        <a
          href={`/${locale}/donate?source=${source}${jobId ? `&jobId=${jobId}` : ''}`}
          className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-center text-sm font-medium text-gray-600 transition hover:border-teal-300 hover:text-teal-600"
        >
          {t('chooseAmount')}
        </a>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{t('error')}</p>}
    </aside>
  )
}
