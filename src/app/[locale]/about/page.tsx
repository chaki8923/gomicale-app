import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'About Us' : '運営者情報',
    alternates: {
      canonical: `/${locale}/about`,
      languages: {
        ja: '/ja/about',
        en: '/en/about',
      },
    },
  }
}

export default async function AboutPage() {
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
          {isEn ? 'About Us' : '運営者情報'}
        </h1>

        <div className="bg-white rounded-3xl shadow-sm p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-teal-500"></div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isEn ? 'Why we created GomiCale' : 'ゴミカレを作った理由'}
          </h2>
          <p className="text-teal-600 font-semibold text-sm mb-8">
            {isEn ? 'From annoying local rules to smart automation' : 'めんどくさい地域のゴミ出しルールを、もっとスマートに'}
          </p>

          <div className="space-y-6 text-base text-gray-700 leading-relaxed">
            <p>
              {isEn
                ? 'Garbage collection rules often vary wildly by area, with complex schedules like "first and third Wednesdays for PET bottles." Keeping track of physical papers or PDFs can be incredibly frustrating.'
                : '「第1・第3水曜はペットボトル」「隔週木曜は資源ごみ」など、地域によって複雑なゴミ出しのルール。冷蔵庫に貼ったカレンダーを見に行ったり、スマホでPDFを毎回開いたりするのはとても面倒です。'}
            </p>
            <p className="font-semibold text-gray-900 bg-teal-50 p-6 rounded-xl border-l-4 border-teal-500">
              {isEn
                ? '"I just want this PDF schedule inside my Google Calendar!"'
                : '「このPDFの予定、そのままGoogleカレンダーに入ってくれればいいのに！」'}
            </p>
            <p>
              {isEn
                ? 'That simple thought sparked the creation of GomiCale. Using AI to instantly parse schedules and rules from a single PDF upload, it registers them directly into Google Calendar, saving you from tedious manual data entry.'
                : 'そんな思いから「ゴミカレ」は生まれました。AIを活用することで、PDFをアップロードするだけで複雑なルールを自動で読み解き、Googleカレンダーに一括登録。手入力の手間をゼロにすることを目指しています。'}
            </p>
            <p>
              {isEn
                ? 'We continue to develop this tool in hopes that it gives you a little extra free time and makes everyday life more comfortable.'
                : '日々のちょっとした煩わしさを解消し、皆様の生活が少しでも快適になるよう、今後も開発を続けてまいります。'}
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {isEn ? 'Operator Profile' : '運営者について'}
            </h3>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex-1 space-y-4 text-sm text-gray-600">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <span className="font-medium text-gray-900">{isEn ? 'Operator' : '運営者'}</span>
                  <span className="col-span-2 sm:col-span-3">Ryo Chaki (茶木 涼)</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <span className="font-medium text-gray-900">{isEn ? 'Email' : '連絡先'}</span>
                  <span className="col-span-2 sm:col-span-3">
                    <a href="mailto:contact@gomicale.jp" className="text-teal-600 hover:underline">contact@gomicale.jp</a>
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <span className="font-medium text-gray-900">{isEn ? 'Service URL' : 'サービスURL'}</span>
                  <span className="col-span-2 sm:col-span-3">
                    <a href="https://gomicale.jp" className="text-teal-600 hover:underline">https://gomicale.jp</a>
                  </span>
                </div>
              </div>
            </div>
          </div>
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
