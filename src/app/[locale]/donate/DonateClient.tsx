'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  DEFAULT_SUPPORT_AMOUNT,
  SUPPORT_AMOUNTS,
  type SupportSource,
} from '@/lib/support'

type DonateClientProps = {
  source: SupportSource
  jobId?: string
}

export function DonateClient({ source, jobId }: DonateClientProps) {
  const t = useTranslations('support')
  const locale = useLocale()
  const [selected, setSelected] = useState<number>(DEFAULT_SUPPORT_AMOUNT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/support/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'support_cta_impression',
        source,
        jobId,
        milestoneKey: 'support-page',
      }),
    }).catch(() => undefined)
  }, [jobId, source])

  async function handleDonate() {
    setLoading(true)
    setError(null)
    void fetch('/api/support/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'support_cta_click',
        source,
        jobId,
        milestoneKey: 'support-page',
        amount: selected,
      }),
    }).catch(() => undefined)

    try {
      const res = await fetch('/api/donate/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selected, source, jobId, locale }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? t('error'))
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'))
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">{t('amountsLabel')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SUPPORT_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => setSelected(amount)}
              className={`py-2 px-1 rounded-lg text-sm font-semibold border transition-all ${
                selected === amount
                  ? 'bg-teal-500 border-teal-500 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-teal-300 hover:text-teal-600'
              }`}
            >
              ¥{amount}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-teal-50 rounded-xl p-4 text-center">
        <p className="text-sm text-gray-600">{t('selectedAmount')}</p>
        <p className="text-2xl font-bold text-teal-600 mt-1">¥{selected}</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      <button
        onClick={handleDonate}
        disabled={loading}
        className="w-full py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-300 text-white font-bold rounded-xl transition-colors text-base"
      >
        {loading ? t('processing') : t('supportAmount', { amount: selected })}
      </button>

      <p className="text-xs text-gray-400 text-center">
        {t('secureCheckout')}
      </p>
    </div>
  )
}
