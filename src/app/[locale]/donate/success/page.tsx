import type { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { PageViewTracker } from '@/components/PageViewTracker'

export const metadata: Metadata = {
  title: 'ご支援ありがとうございます | ゴミカレ',
  robots: { index: false },
}

export default function DonateSuccessPage() {
  return (
    <>
      <PageViewTracker path="/donate/success" />
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-teal-50 mb-6">
          <span className="text-4xl">🎉</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          ご支援ありがとうございます！
        </h1>
        <p className="text-gray-600 text-sm leading-relaxed mb-8">
          温かいご支援、本当にありがとうございます。<br />
          いただいたご支援はサービスの維持・改善に大切に使わせていただきます。<br />
          引き続きゴミカレをよろしくお願いします。
        </p>
        <div className="text-right text-xs text-gray-400 mb-8">
          — ゴミカレ 開発者
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="block w-full py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl transition-colors text-sm"
          >
            トップページへ戻る
          </Link>
          <Link
            href="/dashboard"
            className="block w-full py-3 border border-gray-200 hover:border-teal-300 text-gray-600 hover:text-teal-600 font-medium rounded-xl transition-colors text-sm"
          >
            ダッシュボードへ
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}
