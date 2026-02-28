import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'Legal Notice' : '特定商取引法に基づく表記',
    alternates: {
      canonical: `/${locale}/legal`,
      languages: {
        ja: '/ja/legal',
        en: '/en/legal',
      },
    },
  }
}

export default async function LegalPage() {
  const locale = await getLocale()
  const isEn = locale === 'en'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-teal-600">
            {isEn ? 'GomiCale' : 'ゴミカレ'}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          {isEn ? 'Legal Notice (Specified Commercial Transactions Act)' : '特定商取引法に基づく表記'}
        </h1>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-6">
          <div className="space-y-6">
            {isEn ? (
              <>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Service Provider</h3>
                  <p className="text-gray-700">Ryo Chaki</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Operator</h3>
                  <p className="text-gray-700">Ryo Chaki</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Address</h3>
                  <p className="text-gray-700">83-1 Kamiokkome, Sayama City, Saitama Prefecture 350-1333, Japan</p>
                  <p className="text-sm text-gray-500 mt-2">※ Disclosed promptly upon request</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Contact</h3>
                  <p className="text-gray-700">
                    Contact Form:{' '}
                    <a href="https://forms.gle/6HJHWBrcjTPm2KrL7" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">here</a>
                    <br />Phone: 050-1809-1062
                  </p>
                  <p className="text-sm text-gray-500 mt-2">※ Business hours: Weekdays 10:00–18:00 (excluding holidays)</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Service Price</h3>
                  <p className="text-gray-700">The Service is currently provided <strong>free of charge</strong>.</p>
                  <p className="text-sm text-gray-500 mt-2">※ Users will be notified in advance if paid plans are introduced.</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Additional Costs</h3>
                  <p className="text-gray-700">Internet connection fees and communication costs are the user's responsibility.</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Service Availability</h3>
                  <p className="text-gray-700">The Service is available immediately after account registration is complete.</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Refunds and Cancellation</h3>
                  <p className="text-gray-700">As the Service is currently free, refund provisions do not apply. You may delete your account at any time.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Other</h3>
                  <p className="text-gray-700">
                    For detailed terms of use, please see our{' '}
                    <Link href="/terms" className="text-teal-600 hover:underline">Terms of Service</Link>.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">販売事業者</h3>
                  <p className="text-gray-700">茶木 涼</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">運営責任者</h3>
                  <p className="text-gray-700">茶木 涼</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">所在地</h3>
                  <p className="text-gray-700">〒350-1333<br />埼玉県狭山市上奥富83-1</p>
                  <p className="text-sm text-gray-500 mt-2">※請求があった場合に遅滞なく開示します</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">お問い合わせ</h3>
                  <p className="text-gray-700">
                    お問い合わせフォーム：
                    <a href="https://forms.gle/6HJHWBrcjTPm2KrL7" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">こちら</a>
                    <br />電話番号：050-1809-1062
                  </p>
                  <p className="text-sm text-gray-500 mt-2">※営業時間：平日 10:00〜18:00（土日祝日を除く）</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">サービスの提供価格</h3>
                  <p className="text-gray-700">現在、本サービスは<strong>無料</strong>で提供しています。</p>
                  <p className="text-sm text-gray-500 mt-2">※将来的に有料プランを導入する場合は、事前にユーザーへ通知します。</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">サービスの対価以外に必要な費用</h3>
                  <p className="text-gray-700">インターネット接続料金、通信費用等は、お客様のご負担となります。</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">サービス提供時期</h3>
                  <p className="text-gray-700">アカウント登録完了後、直ちにサービスをご利用いただけます。</p>
                </div>
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">返品・キャンセルについて</h3>
                  <p className="text-gray-700">本サービスは現在無料のため、返金に関する事項は該当しません。アカウントの削除（退会）はいつでも行うことができます。</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">その他</h3>
                  <p className="text-gray-700">
                    サービスの詳細な利用条件については、
                    <Link href="/terms" className="text-teal-600 hover:underline">利用規約</Link>
                    をご確認ください。
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="pt-8 mt-8 border-t border-gray-200">
            <p className="text-sm text-gray-600">{isEn ? 'Posted: February 23, 2026' : '掲載日：2026年2月23日'}</p>
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
