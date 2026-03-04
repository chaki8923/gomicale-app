import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ContactForm } from '@/components/ContactForm'

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
  const t = await getTranslations({ locale, namespace: 'contact' })
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
          {t('title')}
        </h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-8">
          <p className="text-gray-600">
            {t('description')}
          </p>

          <ContactForm />
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
