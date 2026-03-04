import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'Contact Us' : 'お問い合わせ',
    alternates: {
      canonical: `/${locale}/contact`,
      languages: {
        ja: '/ja/contact',
        en: '/en/contact',
      },
    },
  }
}

export default async function ContactPage() {
  const locale = await getLocale()
  const isEn = locale === 'en'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/servise_logo.webp" alt={isEn ? 'GomiCale' : 'ゴミカレ'} width={300} height={80} className="h-16 w-auto object-contain" priority />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          {isEn ? 'Contact Us' : 'お問い合わせ'}
        </h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-6">
          <p className="text-gray-600">
            {isEn 
              ? 'If you have any questions or feedback about the service, please contact us.'
              : 'サービスに関するご質問、ご意見、ご要望等がございましたら、お気軽にお問い合わせください。'
            }
          </p>

          <div className="py-8">
            <a 
              href="mailto:contact@gomicale.jp" 
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-8 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-teal-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {isEn ? 'Send an Email' : 'メールで問い合わせる'}
            </a>
          </div>

          <p className="text-sm text-gray-500">
            {isEn 
              ? 'Depending on the nature of your inquiry, it may take some time for us to reply.'
              : 'お問い合わせの内容によっては、返信までにお時間をいただく場合がございます。あらかじめご了承ください。'
            }
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-teal-600 hover:underline">
            {isEn ? 'Back to Home' : 'トップページに戻る'}
          </Link>
        </div>
      </div>
    </div>
  )
}
