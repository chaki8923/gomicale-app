import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { PageViewTracker } from '@/components/PageViewTracker'
import { fulfillSupportSession } from '@/lib/support-server'

export const metadata: Metadata = {
  title: 'ご支援ありがとうございます | ゴミカレ',
  robots: { index: false },
}

export default async function DonateSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const query = await searchParams
  const sessionId = typeof query.session_id === 'string' ? query.session_id : ''
  const t = await getTranslations({ locale, namespace: 'support' })
  let paid = false

  if (sessionId) {
    try {
      paid = (await fulfillSupportSession(sessionId)).paid
    } catch (error) {
      console.warn('[support] success page verification failed:', error)
    }
  }

  return (
    <>
      <PageViewTracker path="/donate/success" />
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-teal-50 mb-6">
          <span className="text-4xl">{paid ? '🎉' : '⏳'}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {paid ? t('successTitle') : t('pendingTitle')}
        </h1>
        <p className="text-gray-600 text-sm leading-relaxed mb-8">
          {paid ? t('successDescription') : t('pendingDescription')}
        </p>
        <div className="text-right text-xs text-gray-400 mb-8">
          {paid ? t('signature') : null}
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="block w-full py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl transition-colors text-sm"
          >
            {t('backToTop')}
          </Link>
          <Link
            href="/dashboard"
            className="block w-full py-3 border border-gray-200 hover:border-teal-300 text-gray-600 hover:text-teal-600 font-medium rounded-xl transition-colors text-sm"
          >
            {t('backToDashboard')}
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}
