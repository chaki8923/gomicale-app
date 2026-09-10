import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { PageViewTracker } from '@/components/PageViewTracker'
import { DonateClient } from './DonateClient'
import { isSupportSource, isUuid } from '@/lib/support'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'support' })
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false },
  }
}

export default async function DonatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const query = await searchParams
  const t = await getTranslations({ locale, namespace: 'support' })
  const source = isSupportSource(query.source) ? query.source : 'donate_page'
  const jobId = isUuid(query.jobId) ? query.jobId : undefined

  return (
    <>
      <PageViewTracker path="/donate" />
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-50 mb-4">
            <span className="text-3xl">❤️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('pageTitle')}</h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            {t('pageDescription')}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <DonateClient source={source} jobId={jobId} />
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition">
            {t('backToTop')}
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}
