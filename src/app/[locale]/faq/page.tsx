import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: 'よくある質問',
    description: 'ゴミカレに関するよくある質問をまとめています。料金・対応PDF・セキュリティ・スマートフォン対応など。',
    alternates: {
      canonical: `/${locale}/faq`,
      languages: {
        ja: '/ja/faq',
        en: '/en/faq',
      },
    },
  }
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'faq' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const items = t.raw('items') as Array<{ q: string; a: string }>

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: tCommon('topPage'),
        item: `https://gomicale.jp/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: tCommon('faq'),
        item: `https://gomicale.jp/${locale}/faq`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-teal-600">
            {tCommon('appName')}
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/faq" className="text-teal-600 font-medium">{tCommon('faq')}</Link>
              <Link href="/terms" className="hover:text-gray-700 transition">{tCommon('terms')}</Link>
              <Link href="/privacy" className="hover:text-gray-700 transition hidden sm:block">{tCommon('privacy')}</Link>
            </nav>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
        <p className="text-gray-500 mb-10">{t('subtitle')}</p>

        <div className="space-y-4">
          {items.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-3 flex items-start gap-3">
                <span className="text-teal-500 font-bold shrink-0">Q.</span>
                {faq.q}
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed pl-6">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl bg-teal-50 p-6 text-center">
          <p className="text-gray-700 font-medium mb-2">{t('contactTitle')}</p>
          <p className="text-sm text-gray-500 mb-4">{t('contactSubtitle')}</p>
          <Link
            href="/privacy"
            className="inline-block rounded-lg bg-teal-500 px-6 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition"
          >
            {t('contactLink')}
          </Link>
        </div>
      </div>

      <footer className="mt-16 border-t bg-white py-6 text-center text-xs text-gray-400">
        <div className="flex justify-center gap-6 mb-3">
          <Link href="/" className="hover:text-gray-600 transition">{tCommon('topPage')}</Link>
          <Link href="/faq" className="hover:text-gray-600 transition">{tCommon('faq')}</Link>
          <Link href="/terms" className="hover:text-gray-600 transition">{tCommon('terms')}</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition">{tCommon('privacy')}</Link>
          <Link href="/legal" className="hover:text-gray-600 transition">{tCommon('legal')}</Link>
        </div>
        <p>{tCommon('copyright', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
    </>
  )
}
