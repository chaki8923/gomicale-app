import Link from 'next/link'

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-8">プライバシーポリシー</h1>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
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
                <li>
                  <strong>Googleアカウント情報</strong>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>Googleアカウントのメールアドレス</li>
                    <li>Googleカレンダーへのアクセストークン・リフレッシュトークン</li>
                  </ul>
                </li>
                <li>
                  <strong>アップロードされたPDFデータ</strong>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>ユーザーがアップロードしたPDFファイル（ゴミ出しカレンダー等）</li>
                    <li>PDFから解析されたイベント情報（日付・タイトル・詳細）</li>
                  </ul>
                </li>
                <li>
                  <strong>利用情報</strong>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>ジョブの処理履歴（アップロード日時・処理結果）</li>
                    <li>サービス利用ログ</li>
                  </ul>
                </li>
                <li>
                  <strong>アクセス情報</strong>
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>IPアドレス</li>
                    <li>アクセス日時</li>
                    <li>ブラウザ情報</li>
                  </ul>
                </li>
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
              <p>
                本サービスがGoogleアカウントから取得する情報の利用は、以下の目的に限定されます。
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>ユーザーのGoogleカレンダーへの予定の登録・確認</li>
                <li>ユーザーの認証・識別</li>
              </ul>
              <p className="mt-3">
                取得したGoogleアカウント情報は、上記以外の目的には利用せず、第三者への提供も行いません。
              </p>
              <p>
                本サービスのGoogleAPIの利用は、
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:underline"
                >
                  Googleのユーザーデータポリシー
                </a>
                に準拠しています。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第4条（第三者提供）</h2>
            <div className="text-gray-700 space-y-3">
              <p>
                当社は、以下の場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
              </p>
              <ul className="list-decimal list-inside space-y-2 ml-4">
                <li>法令に基づく場合</li>
                <li>人の生命、身体または財産の保護のために必要がある場合であって、ユーザーの同意を得ることが困難である場合</li>
                <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第5条（外部サービスの利用）</h2>
            <div className="text-gray-700 space-y-3">
              <p>本サービスでは、以下の外部サービスを利用しています。</p>
              <ul className="list-disc list-inside space-y-3 ml-4">
                <li>
                  <strong>Supabase</strong>：認証およびデータベース管理
                  <br />
                  <span className="text-sm text-gray-600">
                    <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                      Supabaseのプライバシーポリシー
                    </a>
                  </span>
                </li>
                <li>
                  <strong>Cloudflare R2</strong>：アップロードされたPDFファイルの一時保存
                  <br />
                  <span className="text-sm text-gray-600">
                    <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                      Cloudflareのプライバシーポリシー
                    </a>
                  </span>
                </li>
                <li>
                  <strong>Google Gemini API</strong>：PDFの内容解析（AI機能）
                  <br />
                  <span className="text-sm text-gray-600">
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                      Googleのプライバシーポリシー
                    </a>
                  </span>
                </li>
                <li>
                  <strong>Google Calendar API</strong>：Googleカレンダーへの予定登録
                  <br />
                  <span className="text-sm text-gray-600">
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                      Googleのプライバシーポリシー
                    </a>
                  </span>
                </li>
                <li>
                  <strong>AWS Lambda</strong>：PDFの処理・解析処理の実行
                  <br />
                  <span className="text-sm text-gray-600">
                    <a href="https://aws.amazon.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                      AWSのプライバシーポリシー
                    </a>
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第6条（個人情報の開示・訂正・削除）</h2>
            <div className="text-gray-700 space-y-3">
              <p>
                ユーザーは、自己の個人情報について、開示、訂正、削除を求めることができます。
              </p>
              <p>
                ご希望の場合は、下記お問い合わせ窓口までご連絡ください。
              </p>
              <p>
                アカウントを削除した場合、登録された個人情報およびPDF解析データは削除されます。ただし、法令により保存が義務付けられている情報は、その定められた期間保管します。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第7条（セキュリティ）</h2>
            <div className="text-gray-700 space-y-3">
              <p>
                当社は、個人情報の漏洩、滅失または毀損を防止するため、適切な安全管理措置を講じます。
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>通信の暗号化（SSL/TLS）</li>
                <li>アクセストークンの安全な管理</li>
                <li>アクセス制御およびログ管理</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第8条（Cookie等の利用）</h2>
            <div className="text-gray-700 space-y-3">
              <p>
                本サービスでは、ユーザーの認証状態を維持するため、Cookie等の技術を使用しています。
              </p>
              <p>
                ユーザーは、ブラウザの設定によりCookieの受け入れを拒否することができますが、その場合、本サービスにログインできなくなる可能性があります。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第9条（プライバシーポリシーの変更）</h2>
            <div className="text-gray-700 space-y-3">
              <p>
                当社は、法令の変更や本サービスの機能追加等に伴い、本ポリシーを変更することがあります。変更後のプライバシーポリシーは、本ページに掲載した時点で効力を生じるものとします。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">第10条（お問い合わせ窓口）</h2>
            <div className="text-gray-700 space-y-3">
              <p>本ポリシーに関するお問い合わせは、以下の窓口までお願いいたします。</p>
              <div className="bg-gray-50 p-4 rounded-lg mt-4">
                <p className="font-semibold">ゴミカレ 運営事務局</p>
                <p className="mt-2">
                  {/* TODO: お問い合わせフォームURLを記入 */}
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
