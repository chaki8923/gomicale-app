import type { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { DonateClient } from './DonateClient'

export const metadata: Metadata = {
  title: 'ゴミカレを応援する | ゴミカレ',
  description: '開発継続のためのご支援をお願いしています。50円から500円まで、気持ちに合わせた金額でご寄付いただけます。',
  robots: { index: false },
}

export default function DonatePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-50 mb-4">
            <span className="text-3xl">❤️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">開発者を応援する</h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            ゴミカレはひとりの開発者が作った個人サービスです。<br />
            役に立ったと思っていただけたら、ぜひ開発継続のためのご支援をお願いします。
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <DonateClient />
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition">
            トップページに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
