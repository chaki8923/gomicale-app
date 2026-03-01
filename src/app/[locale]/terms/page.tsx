import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'Terms of Service' : '利用規約',
    alternates: {
      canonical: `/${locale}/terms`,
      languages: {
        ja: '/ja/terms',
        en: '/en/terms',
      },
    },
  }
}

export default async function TermsPage() {
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

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          {isEn ? 'Terms of Service' : '利用規約'}
        </h1>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          {isEn ? <TermsEn /> : <TermsJa />}
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

function TermsJa() {
  return (
    <>
      <section>
        <p className="text-gray-700">
          本利用規約（以下「本規約」といいます）は、ゴミカレ（以下「本サービス」といいます）の提供条件および本サービスの利用に関する当社とユーザーとの間の権利義務関係を定めることを目的とし、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されます。
        </p>
        <p className="text-gray-700 mt-3">
          ユーザーは、本サービスを利用することにより、本規約に同意したものとみなされます。
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第1条（適用）</h2>
        <p className="text-gray-700">本規約は、本サービスの利用に関して、当社とユーザーとの間に適用されます。</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第2条（定義）</h2>
        <div className="text-gray-700 space-y-3">
          <p>本規約において使用する用語の定義は、以下のとおりとします。</p>
          <ul className="list-decimal list-inside space-y-2 ml-4">
            <li>「本サービス」：当社が提供する「ゴミカレ」という名称のウェブサービス</li>
            <li>「ユーザー」：本サービスを利用する個人</li>
            <li>「登録情報」：ユーザーが本サービスの利用にあたって登録する情報</li>
            <li>「PDFデータ」：ユーザーが本サービスに対してアップロードするゴミ出しカレンダー等のPDFファイル</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第3条（アカウント登録）</h2>
        <div className="text-gray-700 space-y-3">
          <p>本サービスの利用を希望する者は、本規約を遵守することに同意し、Googleアカウントを用いたOAuth認証により登録を行うものとします。</p>
          <p>ユーザーは、自己のアカウントを第三者に利用させてはなりません。</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第4条（本サービスの内容）</h2>
        <div className="text-gray-700 space-y-3">
          <p>本サービスは、ユーザーがアップロードしたPDFファイルをAI技術により解析し、ゴミ出しカレンダー等の予定情報をGoogleカレンダーに自動登録する機能を提供します。</p>
          <p>本サービスは現在無料で提供しています。将来的に有料プランを導入する場合は、別途ユーザーに通知します。</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第5条（Googleサービスの利用）</h2>
        <div className="text-gray-700 space-y-3">
          <p>本サービスはGoogleカレンダーAPIを利用しています。本サービスの利用にあたり、ユーザーはGoogleアカウントのカレンダーへのアクセス権限を本サービスに付与することに同意するものとします。</p>
          <p>本サービスが取得するGoogleアカウントへのアクセス権限は、Googleカレンダーへの予定の読み取り・書き込みに限定されます。</p>
          <p>ユーザーは、Googleアカウントの設定画面からいつでも本サービスへのアクセス権限を取り消すことができます。</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第6条（禁止事項）</h2>
        <div className="text-gray-700 space-y-3">
          <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
          <ul className="list-decimal list-inside space-y-2 ml-4">
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪行為に関連する行為</li>
            <li>当社または第三者の知的財産権、プライバシー、名誉その他の権利または利益を侵害する行為</li>
            <li>本サービスのネットワークまたはシステム等に過度な負荷をかける行為</li>
            <li>本サービスの運営を妨害するおそれのある行為</li>
            <li>不正アクセスをし、またはこれを試みる行為</li>
            <li>第三者の個人情報を含むPDFを無断でアップロードする行為</li>
            <li>反社会的勢力に対する利益供与その他の協力行為</li>
            <li>その他、当社が不適切と判断する行為</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第7条（本サービスの停止等）</h2>
        <div className="text-gray-700 space-y-3">
          <p>当社は、以下のいずれかに該当する場合には、ユーザーに事前に通知することなく、本サービスの全部または一部の提供を停止または中断することができるものとします。</p>
          <ul className="list-decimal list-inside space-y-2 ml-4">
            <li>本サービスに係るコンピュータシステムの保守点検または更新を行う場合</li>
            <li>地震、落雷、火災、停電または天災などの不可抗力により本サービスの提供が困難となった場合</li>
            <li>コンピュータまたは通信回線等が事故により停止した場合</li>
            <li>その他、当社が本サービスの提供が困難と判断した場合</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第8条（免責事項）</h2>
        <div className="text-gray-700 space-y-3">
          <p>当社は、本サービスによるAI解析結果（日付・予定タイトル等）の正確性、完全性を保証しません。ユーザーは、登録された予定の内容をご自身で確認のうえ利用するものとします。</p>
          <p>当社は、本サービスの利用または利用不能により生じたいかなる損害についても、当社に故意または重大な過失がある場合を除き、責任を負いません。</p>
          <p>本サービスは、Google LLC が提供するGoogleカレンダーAPIを利用しており、同社のサービス障害等に起因する問題について当社は責任を負いません。</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第9条（準拠法および管轄裁判所）</h2>
        <div className="text-gray-700 space-y-3">
          <p>本規約の解釈にあたっては、日本法を準拠法とします。</p>
          <p>本サービスに関して紛争が生じた場合には、当社の所在地を管轄する裁判所を専属的合意管轄とします。</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">第10条（規約の変更）</h2>
        <p className="text-gray-700">当社は、ユーザーの承諾を得ることなく、いつでも本規約の内容を変更することができるものとします。変更後の本規約は、本サービス上に表示した時点より効力を生じるものとします。</p>
      </section>
      <div className="pt-8 mt-8 border-t border-gray-200">
        <p className="text-sm text-gray-600">制定日：2026年2月23日</p>
        <p className="text-sm text-gray-600 mt-2">運営者：茶木 涼</p>
      </div>
    </>
  )
}

function TermsEn() {
  return (
    <>
      <section>
        <p className="text-gray-700">
          These Terms of Service ("Terms") govern your use of GomiCale ("Service") operated by Ryo Chaki ("we", "us", or "our"). By using the Service, you agree to be bound by these Terms.
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 1 (Application)</h2>
        <p className="text-gray-700">These Terms apply between us and users with respect to use of the Service.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 2 (Definitions)</h2>
        <div className="text-gray-700 space-y-3">
          <p>The following definitions apply in these Terms:</p>
          <ul className="list-decimal list-inside space-y-2 ml-4">
            <li>"Service": The web service named "GomiCale" provided by us</li>
            <li>"User": An individual who uses the Service</li>
            <li>"Registration Information": Information registered by users when using the Service</li>
            <li>"PDF Data": PDF files (such as garbage collection calendars) uploaded by users to the Service</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 3 (Account Registration)</h2>
        <div className="text-gray-700 space-y-3">
          <p>Those wishing to use the Service must agree to comply with these Terms and register via OAuth authentication using their Google account.</p>
          <p>Users must not allow third parties to use their account.</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 4 (Service Content)</h2>
        <div className="text-gray-700 space-y-3">
          <p>The Service analyzes PDF files uploaded by users using AI technology and provides functionality to automatically register schedule information such as garbage collection calendars to Google Calendar.</p>
          <p>The Service is currently provided free of charge. Users will be separately notified if paid plans are introduced in the future.</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 5 (Use of Google Services)</h2>
        <div className="text-gray-700 space-y-3">
          <p>The Service uses the Google Calendar API. By using the Service, users agree to grant the Service access to their Google account's calendar.</p>
          <p>Access to Google accounts obtained by the Service is limited to reading and writing events to Google Calendar.</p>
          <p>Users may revoke the Service's access permissions at any time from their Google Account settings.</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 6 (Prohibited Actions)</h2>
        <div className="text-gray-700 space-y-3">
          <p>Users must not engage in any of the following when using the Service:</p>
          <ul className="list-decimal list-inside space-y-2 ml-4">
            <li>Acts that violate laws or public order and morals</li>
            <li>Acts related to criminal activity</li>
            <li>Acts that infringe on intellectual property rights, privacy, or other rights of us or third parties</li>
            <li>Acts that place excessive load on the Service's network or systems</li>
            <li>Acts that may interfere with Service operations</li>
            <li>Unauthorized access or attempts to do so</li>
            <li>Uploading PDFs containing third-party personal information without authorization</li>
            <li>Any other acts we deem inappropriate</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 7 (Service Suspension)</h2>
        <div className="text-gray-700 space-y-3">
          <p>We may suspend or interrupt all or part of the Service without prior notice to users in any of the following cases:</p>
          <ul className="list-decimal list-inside space-y-2 ml-4">
            <li>When performing maintenance or updates to computer systems related to the Service</li>
            <li>When it becomes difficult to provide the Service due to force majeure such as earthquakes, lightning, fires, power outages, or natural disasters</li>
            <li>When computers or communication lines are stopped due to an accident</li>
            <li>When we determine it is otherwise difficult to provide the Service</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 8 (Disclaimer)</h2>
        <div className="text-gray-700 space-y-3">
          <p>We do not guarantee the accuracy or completeness of AI analysis results (dates, event titles, etc.) from the Service. Users must verify registered event content themselves.</p>
          <p>We are not liable for any damages arising from use or inability to use the Service, except in cases of intentional misconduct or gross negligence.</p>
          <p>The Service uses the Google Calendar API provided by Google LLC, and we are not responsible for issues arising from Google's service failures.</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 9 (Governing Law and Jurisdiction)</h2>
        <div className="text-gray-700 space-y-3">
          <p>These Terms shall be governed by and construed in accordance with Japanese law.</p>
          <p>Any disputes related to the Service shall be subject to the exclusive jurisdiction of the court having jurisdiction over our location.</p>
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Article 10 (Changes to Terms)</h2>
        <p className="text-gray-700">We may change the content of these Terms at any time without user consent. Changes take effect when displayed on the Service.</p>
      </section>
      <div className="pt-8 mt-8 border-t border-gray-200">
        <p className="text-sm text-gray-600">Established: February 23, 2026</p>
        <p className="text-sm text-gray-600 mt-2">Operator: Ryo Chaki</p>
      </div>
    </>
  )
}
