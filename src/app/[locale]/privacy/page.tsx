import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'Privacy Policy' : 'プライバシーポリシー',
    alternates: {
      canonical: `/${locale}/privacy`,
      languages: {
        ja: '/ja/privacy',
        en: '/en/privacy',
      },
    },
  }
}

export default async function PrivacyPage() {
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
          {isEn ? 'Privacy Policy' : 'プライバシーポリシー'}
        </h1>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          {isEn ? <PrivacyEn /> : <PrivacyJa />}
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

function PrivacyJa() {
  return (
    <>
      <section>
        <p className="text-gray-700">
          茶木 涼（以下「当社」といいます）は、ゴミカレ（以下「本サービス」といいます）の提供にあたり、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第1条（収集する情報）</h2>
        <div className="text-gray-700 space-y-3">
          <p>当社は、本サービスの提供にあたり、以下の情報を取得します。</p>
          <ul className="list-decimal list-inside space-y-2 ml-4">
            <li><strong>Googleアカウント情報</strong>：メールアドレス、アクセストークン・リフレッシュトークン</li>
            <li><strong>アップロードされたPDFデータ</strong>：PDFファイルおよびから解析されたイベント情報</li>
            <li><strong>利用情報</strong>：ジョブの処理履歴、サービス利用ログ</li>
            <li><strong>アクセス情報</strong>：IPアドレス、アクセス日時、ブラウザ情報</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第2条（利用目的）</h2>
        <div className="text-gray-700 space-y-3">
          <p>当社は、取得した個人情報を以下の目的で利用します。</p>
          <ul className="list-decimal list-inside space-y-2 ml-4">
            <li>本サービスの提供（PDFの解析・Googleカレンダーへの予定登録）のため</li>
            <li>ユーザー認証および本人確認のため</li>
            <li>本サービスの維持・改善のため</li>
            <li>お問い合わせへの対応のため</li>
            <li>本サービスに関する重要なお知らせや規約変更等の通知のため</li>
            <li>利用規約違反行為の調査および対応のため</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第3条（Googleユーザーデータの利用）</h2>
        <div className="text-gray-700 space-y-3">
          <p>本サービスがGoogleアカウントから取得する情報の利用は、以下の目的に限定されます。</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>ユーザーのGoogleカレンダーへの予定の登録・確認</li>
            <li>ユーザーの認証・識別</li>
          </ul>
          <p className="mt-3">取得したGoogleアカウント情報は、上記以外の目的には利用せず、第三者への提供も行いません。</p>
          <p>本サービスのGoogleAPIの利用は、
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
              Googleのユーザーデータポリシー
            </a>
            に準拠しています。
          </p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第4条（第三者提供）</h2>
        <div className="text-gray-700 space-y-3">
          <p>当社は、法令に基づく場合、人の生命・財産保護のために必要な場合、または国の機関等への協力が必要な場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第5条（外部サービスの利用）</h2>
        <div className="text-gray-700 space-y-3">
          <p>本サービスでは、Supabase（認証・DB）、Cloudflare R2（PDF一時保存）、Google Gemini API（AI解析）、Google Calendar API（カレンダー登録）、AWS Lambda（処理実行）を利用しています。</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第6条（個人情報の開示・訂正・削除）</h2>
        <div className="text-gray-700 space-y-3">
          <p>ユーザーは、自己の個人情報について、開示、訂正、削除を求めることができます。ご希望の場合は、下記お問い合わせ窓口までご連絡ください。</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第7条（セキュリティ）</h2>
        <div className="text-gray-700 space-y-3">
          <p>当社は、SSL/TLS通信の暗号化、アクセストークンの安全な管理、アクセス制御およびログ管理により、個人情報の保護に努めます。</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第10条（お問い合わせ窓口）</h2>
        <div className="text-gray-700 space-y-3">
          <p>本ポリシーに関するお問い合わせは、以下の窓口までお願いいたします。</p>
          <div className="bg-gray-50 p-4 rounded-lg mt-4">
            <p className="font-semibold">ゴミカレ 運営事務局</p>
            <p className="mt-2">
              <a href="https://forms.gle/6HJHWBrcjTPm2KrL7" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                お問い合わせフォーム
              </a>
            </p>
          </div>
        </div>
      </section>
      <div className="pt-8 mt-8 border-t border-gray-200">
        <p className="text-sm text-gray-600">制定日：2026年2月23日</p>
        <p className="text-sm text-gray-600 mt-2">運営者：茶木 涼</p>
      </div>
    </>
  )
}

function PrivacyEn() {
  return (
    <>
      <section>
        <p className="text-gray-700">
          Ryo Chaki ("we", "us", or "our") has established the following Privacy Policy ("Policy") regarding the handling of user personal information in providing GomiCale ("Service").
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 1 (Information Collected)</h2>
        <div className="text-gray-700 space-y-3">
          <p>We collect the following information in providing the Service:</p>
          <ul className="list-decimal list-inside space-y-2 ml-4">
            <li><strong>Google Account Information</strong>: Email address, access tokens, and refresh tokens</li>
            <li><strong>Uploaded PDF Data</strong>: PDF files and event information extracted from them</li>
            <li><strong>Usage Information</strong>: Job processing history, service usage logs</li>
            <li><strong>Access Information</strong>: IP address, access date/time, browser information</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 2 (Purpose of Use)</h2>
        <div className="text-gray-700 space-y-3">
          <p>We use collected personal information for the following purposes:</p>
          <ul className="list-decimal list-inside space-y-2 ml-4">
            <li>Providing the Service (PDF analysis and Google Calendar registration)</li>
            <li>User authentication and identity verification</li>
            <li>Maintaining and improving the Service</li>
            <li>Responding to inquiries</li>
            <li>Notifying users of important announcements and policy changes</li>
            <li>Investigating and responding to terms of service violations</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 3 (Google User Data)</h2>
        <div className="text-gray-700 space-y-3">
          <p>Use of information obtained from Google accounts is limited to: registering and reviewing events in users' Google Calendar, and user authentication.</p>
          <p>Our use of Google APIs complies with the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Google API Services User Data Policy</a>.</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 4 (Third-Party Disclosure)</h2>
        <p className="text-gray-700">We will not provide personal information to third parties without user consent, except as required by law, to protect life or property, or to cooperate with government agencies.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 5 (Third-Party Services)</h2>
        <p className="text-gray-700">The Service uses Supabase (authentication/database), Cloudflare R2 (temporary PDF storage), Google Gemini API (AI analysis), Google Calendar API (calendar registration), and AWS Lambda (processing).</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 6 (Disclosure, Correction, Deletion)</h2>
        <p className="text-gray-700">Users may request disclosure, correction, or deletion of their personal information. Please contact us via the inquiry form below.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 7 (Security)</h2>
        <p className="text-gray-700">We protect personal information through SSL/TLS encryption, secure token management, and access control and logging.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 10 (Contact)</h2>
        <div className="text-gray-700 space-y-3">
          <div className="bg-gray-50 p-4 rounded-lg mt-4">
            <p className="font-semibold">GomiCale Support</p>
            <p className="mt-2">
              <a href="https://forms.gle/6HJHWBrcjTPm2KrL7" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                Contact Form
              </a>
            </p>
          </div>
        </div>
      </section>
      <div className="pt-8 mt-8 border-t border-gray-200">
        <p className="text-sm text-gray-600">Established: February 23, 2026</p>
        <p className="text-sm text-gray-600 mt-2">Operator: Ryo Chaki</p>
      </div>
    </>
  )
}
