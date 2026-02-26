import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'よくある質問（FAQ）',
  description: 'ゴミカレに関するよくある質問をまとめました。PDFのアップロード方法、Googleカレンダーへの登録方法、対応ファイル形式、個人情報の取り扱いなど、疑問点はこちらでご確認ください。',
}

const faqs = [
  {
    q: 'ゴミカレとは何ですか？',
    a: 'ゴミカレは、自治体が配布するゴミ出しカレンダーや学校・地域のPDF予定表をAIが自動で読み取り、Googleカレンダーに一括登録する無料のWebサービスです。毎年手入力していた煩雑な作業をたった1分で完了させることができます。',
  },
  {
    q: '料金はかかりますか？',
    a: '現在、ゴミカレは完全無料でご利用いただけます。Googleアカウントでログインするだけで、すべての機能をご利用いただけます。将来的に一部プレミアム機能を提供する可能性がありますが、基本機能は引き続き無料でご提供する予定です。',
  },
  {
    q: 'どのようなPDFに対応していますか？',
    a: '自治体が配布するゴミ出しカレンダーのPDFを主な対象としています。また、学校の年間行事予定表、地域の広報カレンダー、マンションの管理組合予定表など、日付と予定が記載されたPDF全般に対応しています。画像スキャンのPDFやテキストデータのPDF、いずれも処理が可能です。ただし、極めて複雑なレイアウトや文字が不鮮明なPDFは正確に読み取れない場合があります。',
  },
  {
    q: 'Googleカレンダーのどのカレンダーに登録されますか？',
    a: 'ログインしたGoogleアカウントのデフォルトカレンダー（通常はアカウントのメールアドレス名のカレンダー）に登録されます。登録後はGoogleカレンダー上で通常のイベントと同様に編集・削除・カレンダーの移動が可能です。',
  },
  {
    q: '登録できる件数に上限はありますか？',
    a: '1回のPDFアップロードで登録できる予定件数に上限は設けていません。年間分のゴミ出しスケジュールを一度にまとめて登録することが可能です。ただし、PDFのページ数が非常に多い場合や複雑なレイアウトの場合は処理に数分かかることがあります。',
  },
  {
    q: 'PDFの内容が正しく読み取れなかった場合はどうすればいいですか？',
    a: 'AIの解析結果はGoogleカレンダー上で直接編集いただけます。また、解析精度はPDFの品質やレイアウトに依存します。スキャンの解像度が低い場合や、表が複雑に入り組んでいる場合は精度が下がることがあります。問題が発生した場合はお問い合わせページよりご連絡ください。',
  },
  {
    q: 'アップロードしたPDFはどのように管理されますか？',
    a: 'アップロードされたPDFは、AI解析処理のために一時的にサーバーに保存されます。解析完了後は自動的に削除されます。PDFの内容を第三者に公開したり、マーケティング目的で利用することは一切ありません。詳しくはプライバシーポリシーをご確認ください。',
  },
  {
    q: 'Googleカレンダーへのアクセス権限が心配です。',
    a: 'ゴミカレはGoogleの公式OAuth認証を使用しており、Googleカレンダーへのイベント追加に必要な最小限の権限のみを取得します。パスワードを取得することはなく、Googleアカウントの設定からいつでも連携を解除することができます。連携解除の手順はGoogleアカウントの「セキュリティ」→「サードパーティのアプリとサービス」から行えます。',
  },
  {
    q: 'すでにGoogleカレンダーに登録済みの予定と重複しませんか？',
    a: 'ゴミカレはPDFから抽出した予定をGoogleカレンダーに新規追加します。既存の予定との重複チェックを行い、同じ日時・タイトルの予定が既に登録されている場合はスキップする仕組みになっています。ダッシュボードの登録履歴でスキップ件数も確認いただけます。',
  },
  {
    q: 'スマートフォンからも使えますか？',
    a: 'はい、スマートフォンのブラウザからもご利用いただけます。iPhoneのSafari、AndroidのChrome等の標準ブラウザに対応しています。PDFファイルはスマートフォンの写真アプリやファイルアプリから選択してアップロードすることができます。',
  },
  {
    q: '対応していない自治体はありますか？',
    a: 'ゴミカレは特定の自治体に依存せず、PDF形式のカレンダーであれば全国どの自治体にも対応しています。ただし、自治体によってゴミ出しカレンダーのPDF配布方法や形式が異なるため、一部のPDFでは読み取り精度が下がる場合があります。',
  },
  {
    q: 'アカウントの削除はできますか？',
    a: 'はい、お問い合わせいただくことでアカウントと関連データの削除対応が可能です。削除すると、登録履歴やGoogleアカウントとの連携情報がすべて削除されます。なお、すでにGoogleカレンダーに登録した予定は削除されませんので、必要に応じてGoogleカレンダー側で削除してください。',
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-teal-600">
            ♻️ ゴミカレ
          </Link>
          <nav className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/faq" className="text-teal-600 font-medium">よくある質問</Link>
            <Link href="/terms" className="hover:text-gray-700 transition">利用規約</Link>
            <Link href="/privacy" className="hover:text-gray-700 transition">プライバシーポリシー</Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">よくある質問</h1>
        <p className="text-gray-500 mb-10">ゴミカレに関するよくある疑問をまとめました。</p>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-3 flex items-start gap-3">
                <span className="text-teal-500 font-bold shrink-0">Q.</span>
                {faq.q}
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed pl-6">
                {faq.a}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl bg-teal-50 p-6 text-center">
          <p className="text-gray-700 font-medium mb-2">解決しない場合はお問い合わせください</p>
          <p className="text-sm text-gray-500 mb-4">プライバシーポリシーのお問い合わせ先よりご連絡いただけます。</p>
          <Link
            href="/privacy"
            className="inline-block rounded-lg bg-teal-500 px-6 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition"
          >
            お問い合わせ先を確認する
          </Link>
        </div>
      </div>

      <footer className="mt-16 border-t bg-white py-6 text-center text-xs text-gray-400">
        <div className="flex justify-center gap-6 mb-3">
          <Link href="/" className="hover:text-gray-600 transition">トップページ</Link>
          <Link href="/faq" className="hover:text-gray-600 transition">よくある質問</Link>
          <Link href="/terms" className="hover:text-gray-600 transition">利用規約</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition">プライバシーポリシー</Link>
          <Link href="/legal" className="hover:text-gray-600 transition">特定商取引法に基づく表記</Link>
        </div>
        <p>© {new Date().getFullYear()} ゴミカレ</p>
      </footer>
    </div>
  )
}
