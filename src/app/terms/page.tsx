import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="text-2xl font-bold text-teal-600">
            ゴミカレ
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">利用規約</h1>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
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
            <div className="text-gray-700 space-y-3">
              <p>
                本規約は、本サービスの利用に関して、当社とユーザーとの間に適用されます。
              </p>
            </div>
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
              <p>
                本サービスの利用を希望する者は、本規約を遵守することに同意し、Googleアカウントを用いたOAuth認証により登録を行うものとします。
              </p>
              <p>
                ユーザーは、自己のアカウントを第三者に利用させてはなりません。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第4条（本サービスの内容）</h2>
            <div className="text-gray-700 space-y-3">
              <p>
                本サービスは、ユーザーがアップロードしたPDFファイルをAI技術により解析し、ゴミ出しカレンダー等の予定情報をGoogleカレンダーに自動登録する機能を提供します。
              </p>
              <p>
                本サービスは現在無料で提供しています。将来的に有料プランを導入する場合は、別途ユーザーに通知します。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第5条（Googleサービスの利用）</h2>
            <div className="text-gray-700 space-y-3">
              <p>
                本サービスはGoogleカレンダーAPIを利用しています。本サービスの利用にあたり、ユーザーはGoogleアカウントのカレンダーへのアクセス権限を本サービスに付与することに同意するものとします。
              </p>
              <p>
                本サービスが取得するGoogleアカウントへのアクセス権限は、Googleカレンダーへの予定の読み取り・書き込みに限定されます。
              </p>
              <p>
                ユーザーは、Googleアカウントの設定画面からいつでも本サービスへのアクセス権限を取り消すことができます。
              </p>
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
              <p>
                当社は、以下のいずれかに該当する場合には、ユーザーに事前に通知することなく、本サービスの全部または一部の提供を停止または中断することができるものとします。
              </p>
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
              <p>
                当社は、本サービスによるAI解析結果（日付・予定タイトル等）の正確性、完全性を保証しません。ユーザーは、登録された予定の内容をご自身で確認のうえ利用するものとします。
              </p>
              <p>
                当社は、本サービスの利用または利用不能により生じたいかなる損害についても、当社に故意または重大な過失がある場合を除き、責任を負いません。
              </p>
              <p>
                本サービスは、Google LLC が提供するGoogleカレンダーAPIを利用しており、同社のサービス障害等に起因する問題について当社は責任を負いません。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第9条（準拠法および管轄裁判所）</h2>
            <div className="text-gray-700 space-y-3">
              <p>本規約の解釈にあたっては、日本法を準拠法とします。</p>
              <p>
                本サービスに関して紛争が生じた場合には、当社の所在地を管轄する裁判所を専属的合意管轄とします。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第10条（規約の変更）</h2>
            <div className="text-gray-700 space-y-3">
              <p>
                当社は、ユーザーの承諾を得ることなく、いつでも本規約の内容を変更することができるものとします。変更後の本規約は、本サービス上に表示した時点より効力を生じるものとします。
              </p>
            </div>
          </section>

          <div className="pt-8 mt-8 border-t border-gray-200">
            <p className="text-sm text-gray-600">制定日：2026年2月23日</p>
            <p className="text-sm text-gray-600 mt-2">運営者：茶木 涼</p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-teal-600 hover:underline">
            トップページに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
