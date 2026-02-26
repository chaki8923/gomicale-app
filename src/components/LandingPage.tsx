'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Mousewheel, Pagination } from 'swiper/modules'
import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import 'swiper/css'
import 'swiper/css/pagination'
import { GoogleLoginButton } from './GoogleLoginButton'
import { AdBanner } from './AdBanner'

// ─── SVG アイコン ───────────────────────────────────────────
function IconRecycle({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/>
      <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/>
      <path d="m14 16-3 3 3 3"/>
      <path d="M8.293 13.596 7.196 9.5 3.1 10.598"/>
      <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/>
      <path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>
    </svg>
  )
}

function IconFileText({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  )
}

function IconBrain({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
      <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
      <path d="M6 18a4 4 0 0 1-1.967-.516"/>
      <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
    </svg>
  )
}

function IconCalendar({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <path d="M8 14h.01"/>
      <path d="M12 14h.01"/>
      <path d="M16 14h.01"/>
      <path d="M8 18h.01"/>
      <path d="M12 18h.01"/>
      <path d="M16 18h.01"/>
    </svg>
  )
}

function IconSparkles({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>
  )
}

function IconCheck({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  )
}

const slides: Array<{
  id: string
  content?: 'hero' | 'cta'
  icon?: ReactNode
  step?: string
  heading?: string
  body?: string
  note?: string
  bgImage: string
}> = [
  {
    id: 'hero',
    content: 'hero',
    bgImage: '/gomi_mother.png',
  },
  {
    id: 'upload',
    icon: <IconFileText />,
    step: '01',
    heading: 'PDFからカレンダー登録まで、アップロードするだけ',
    body: '自治体から配られるゴミ出しカレンダーや学校の予定表PDFをドラッグ＆ドロップ。複雑なレイアウトも、AIが自動で読み解きます。',
    note: '手入力や転記ミスはもう不要',
    bgImage: '/house_mother.webp',
  },
  {
    id: 'ai',
    icon: <IconBrain />,
    step: '02',
    heading: 'AIが複雑なゴミ出しルールも正確に解析',
    body: '「第1・第3水曜はペットボトル」「月に1回の粗大ごみ」── PDF特有の複雑なルールもAIなら間違えません。年間分のスケジュールを一気に抽出します。',
    note: '見落としゼロで、ゴミ出し当日のリマインダーも自動設定',
    bgImage: '/anger_mother.webp',
  },
  {
    id: 'calendar',
    icon: <IconCalendar />,
    step: '03',
    heading: 'PDFの予定をGoogleカレンダーに自動登録',
    body: '抽出したデータは、お使いのGoogleカレンダーに一括で自動登録されます。PDFに書かれた日付と予定なら何でもカレンダー登録できます。',
    note: 'ゴミ出しカレンダー以外のPDFにも対応',
    bgImage: '/calendar_mother.webp',
  },
  {
    id: 'cta',
    content: 'cta',
    bgImage: '/enjoy_mother.webp',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen w-screen">
      {/* ナビゲーションヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-gray-100 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-teal-600">
          <IconRecycle className="w-5 h-5" />
          ゴミカレ
        </Link>
        <nav className="flex items-center gap-5 text-sm text-gray-500">
          <Link href="/faq" className="hover:text-teal-600 transition">よくある質問</Link>
          <Link href="/terms" className="hover:text-teal-600 transition hidden sm:block">利用規約</Link>
          <Link href="/login" className="rounded-lg bg-teal-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-600 transition">
            ログイン
          </Link>
        </nav>
      </header>

      {/* フルスクリーン Swiper */}
      <div className="h-screen w-screen overflow-hidden">
        <Swiper
        modules={[Mousewheel, Pagination]}
        direction="vertical"
        slidesPerView={1}
        mousewheel={{ sensitivity: 1, thresholdDelta: 30 }}
        pagination={{ clickable: true }}
        speed={700}
        className="h-full w-full"
        style={
          {
            '--swiper-pagination-color': '#0d9488',
            '--swiper-pagination-bullet-inactive-color': '#9ca3af',
            '--swiper-pagination-bullet-inactive-opacity': '0.5',
          } as React.CSSProperties
        }
      >
        {slides.map((slide, i) => (
          <SwiperSlide key={slide.id}>
            <div className="relative flex h-full w-full items-center justify-center">
              <Image
                src={slide.bgImage}
                alt=""
                fill
                className="object-cover opacity-[0.18]"
                priority={i === 0}
              />
              <div className="relative z-10 flex h-full w-full items-center justify-center">
                {slide.content === 'hero' ? (
                  <HeroSlide />
                ) : slide.content === 'cta' ? (
                  <CtaSlide />
                ) : (
                  <FeatureSlide
                    icon={slide.icon!}
                    step={slide.step!}
                    heading={slide.heading!}
                    body={slide.body!}
                    note={slide.note!}
                  />
                )}
              </div>
            </div>
          </SwiperSlide>
        ))}
        </Swiper>
      </div>

      {/* クローラー向け静的コンテンツ（Swiper外） */}
      <StaticContent />
    </div>
  )
}


function StaticContent() {
  return (
    <div className="bg-gray-50">
      {/* サービス詳細説明 */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">ゴミカレとは</h2>
        <p className="text-center text-gray-500 text-sm mb-12">PDFをアップロードするだけで、ゴミ出し予定がGoogleカレンダーに自動登録されます</p>
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="flex justify-center mb-4">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-teal-50 text-teal-500">
                <IconFileText className="w-7 h-7" />
              </span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">STEP 1: PDFをアップロード</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              自治体から配布されるゴミ出しカレンダーのPDFをドラッグ＆ドロップ。学校の年間予定表など、日付が書かれたPDF全般に対応しています。
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="flex justify-center mb-4">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-teal-50 text-teal-500">
                <IconBrain className="w-7 h-7" />
              </span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">STEP 2: AIが自動解析</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              「第1・第3水曜はペットボトル」といった複雑なルールもAIが正確に読み取ります。手入力での転記ミスはもう不要です。
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="flex justify-center mb-4">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-teal-50 text-teal-500">
                <IconCalendar className="w-7 h-7" />
              </span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">STEP 3: カレンダーに自動登録</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              解析結果はGoogleカレンダーに一括で自動登録されます。スマートフォンのリマインダーも自動設定され、ゴミ出しを見逃しません。
            </p>
          </div>
        </div>
      </section>

      {/* FAQ抜粋 */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">よくある質問</h2>
          <p className="text-center text-gray-500 text-sm mb-10">ご利用前によくいただく質問をまとめました</p>
          <div className="space-y-4">
            {[
              {
                q: '料金はかかりますか？',
                a: '現在、ゴミカレは完全無料でご利用いただけます。Googleアカウントでログインするだけで、すべての機能をお使いいただけます。',
              },
              {
                q: 'どのようなPDFに対応していますか？',
                a: 'ゴミ出しカレンダーを主な対象としていますが、学校の行事予定表や地域の広報カレンダーなど、日付と予定が記載されたPDF全般に対応しています。',
              },
              {
                q: 'アップロードしたPDFは安全ですか？',
                a: 'PDFはAI解析のために一時的に保存されますが、解析完了後は自動的に削除されます。第三者への公開や広告利用は一切行いません。',
              },
              {
                q: 'スマートフォンからも使えますか？',
                a: 'はい、iPhoneのSafariやAndroidのChromeなど、スマートフォンの標準ブラウザからご利用いただけます。',
              },
            ].map((faq, i) => (
              <div key={i} className="rounded-xl border border-gray-100 p-5">
                <p className="font-semibold text-gray-800 mb-2 flex items-start gap-2">
                  <span className="text-teal-500 shrink-0">Q.</span>{faq.q}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/faq"
              className="inline-block rounded-xl border border-teal-500 px-6 py-3 text-sm font-semibold text-teal-600 hover:bg-teal-50 transition"
            >
              すべてのよくある質問を見る →
            </Link>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t bg-gray-50 py-8 text-center text-xs text-gray-400">
        <div className="flex justify-center gap-6 mb-3">
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

function HeroSlide() {
  return (
    <div className="flex flex-col items-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-teal-50 text-teal-500">
          <IconRecycle className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          <span className="block">ゴミカレ</span>
          <span className="mt-2 block text-2xl sm:text-3xl">PDFからGoogleカレンダーへ自動登録</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600 sm:text-xl">
          ゴミ出しカレンダーや予定表のPDFをアップロードするだけ。<br className="hidden sm:block" />
          AIが解析してGoogleカレンダーに一括登録します。
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 text-sm text-gray-500 font-medium">
        <p className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 text-white shrink-0">
            <IconCheck className="w-3 h-3" />
          </span>
          PDFをアップロードするだけ
        </p>
        <p className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 text-white shrink-0">
            <IconCheck className="w-3 h-3" />
          </span>
          AIが自動でスケジュール抽出
        </p>
        <p className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 text-white shrink-0">
            <IconCheck className="w-3 h-3" />
          </span>
          Googleカレンダーに一括登録
        </p>
      </div>

      <GoogleLoginButton className="flex items-center gap-3 rounded-2xl bg-teal-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-teal-600 hover:shadow-xl active:scale-95" />

      <p className="text-xs font-bold text-teal-700 animate-bounce">
        スクロールして詳しく見る ↓
      </p>
    </div>
  )
}

function FeatureSlide({
  icon,
  step,
  heading,
  body,
  note,
}: {
  icon: ReactNode
  step: string
  heading: string
  body: string
  note: string
}) {
  return (
    <div className="flex max-w-lg flex-col items-center gap-6 px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/70 text-teal-500 shadow-sm">
        {icon}
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold tracking-widest text-gray-400">
          STEP {step}
        </span>
        <h2 className="text-2xl font-bold text-gray-800 sm:text-3xl">
          {heading}
        </h2>
        <p className="text-base leading-relaxed text-gray-600">{body}</p>
      </div>
      <div className="rounded-xl bg-white/60 px-5 py-3">
        <p className="text-sm font-medium text-teal-700">{note}</p>
      </div>
    </div>
  )
}

function CtaSlide() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="flex flex-col gap-3">
          <div className="flex justify-center">
            <span className="flex items-center justify-center w-16 h-16 rounded-full bg-teal-50 text-teal-500">
              <IconSparkles className="w-8 h-8" />
            </span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 sm:text-4xl">
            手入力とはおさらば
          </h2>
          <p className="text-lg text-gray-500">
            1分で1年分の予定登録が完了。
            <br />
            さあ、今すぐはじめよう！
          </p>
        </div>

        <GoogleLoginButton className="flex items-center gap-3 rounded-2xl bg-teal-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-teal-600 hover:shadow-xl active:scale-95" />

        <div className="flex flex-col items-center gap-1 text-xs text-gray-400">
          <p>完全無料で利用できます</p>
          <p>Googleアカウントでかんたんログイン</p>
        </div>
      </div>

      <div className="w-full px-4 pb-2">
        <AdBanner slot="3248117735" format="horizontal" height={90} />
      </div>

      <footer className="w-full py-4 text-center text-xs text-teal-700/60">
        <div className="flex justify-center gap-4">
          <Link href="/terms" className="hover:text-teal-700 hover:underline">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-teal-700 hover:underline">
            プライバシーポリシー
          </Link>
          <Link href="/legal" className="hover:text-teal-700 hover:underline">
            特定商取引法に基づく表記
          </Link>
        </div>
        <p className="mt-4">© {new Date().getFullYear()} ゴミカレ</p>
      </footer>
    </div>
  )
}
