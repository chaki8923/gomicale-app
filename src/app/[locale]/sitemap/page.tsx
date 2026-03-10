import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export const metadata = {
  title: 'サイトマップ / Sitemap',
}

export default function SitemapPage() {
  const tCommon = useTranslations('common')
  const tLanding = useTranslations('landing')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/servise_logo.webp" alt={tCommon('appName')} width={300} height={80} className="h-16 w-auto object-contain" priority />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          サイトマップ / Sitemap
        </h1>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-teal-600 mb-4 border-b pb-2">メインコンテンツ (Main)</h2>
            <ul className="space-y-3 pl-4">
              <li>
                <Link href="/" className="text-gray-700 hover:text-teal-600 hover:underline">
                  {tCommon('topPage')}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-gray-700 hover:text-teal-600 hover:underline">
                  {tCommon('blog')}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-700 hover:text-teal-600 hover:underline">
                  {tLanding('header.faq')}
                </Link>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-600 mb-4 border-b pb-2">サービス情報 (Information)</h2>
            <ul className="space-y-3 pl-4">
              <li>
                <Link href="/about" className="text-gray-700 hover:text-teal-600 hover:underline">
                  {tCommon('about')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-700 hover:text-teal-600 hover:underline">
                  {tCommon('contact')}
                </Link>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-600 mb-4 border-b pb-2">規約・ポリシー (Legal & Policy)</h2>
            <ul className="space-y-3 pl-4">
              <li>
                <Link href="/terms" className="text-gray-700 hover:text-teal-600 hover:underline">
                  {tCommon('terms')}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-700 hover:text-teal-600 hover:underline">
                  {tCommon('privacy')}
                </Link>
              </li>
              <li>
                <Link href="/legal" className="text-gray-700 hover:text-teal-600 hover:underline">
                  {tCommon('legal')}
                </Link>
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-teal-600 hover:underline">
            トップページに戻る / Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
