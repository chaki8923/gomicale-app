'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Mousewheel, Pagination } from 'swiper/modules'
import Link from 'next/link'
import Image from 'next/image'
import 'swiper/css'
import 'swiper/css/pagination'
import { GoogleLoginButton } from './GoogleLoginButton'
import { AdBanner } from './AdBanner'

const slides = [
  {
    id: 'hero',
    content: 'hero' as const,
    bgImage: '/gomi_mother.png',
  },
  {
    id: 'upload',
    icon: '📄',
    step: '01',
    heading: 'PDFからカレンダー登録まで、アップロードするだけ',
    body: '自治体から配られるゴミ出しカレンダーや学校の予定表PDFをドラッグ＆ドロップ。複雑なレイアウトも、AIが自動で読み解きます。',
    note: '手入力や転記ミスはもう不要',
    bgImage: '/house_mother.webp',
  },
  {
    id: 'ai',
    icon: '🤖',
    step: '02',
    heading: 'AIが複雑なゴミ出しルールも正確に解析',
    body: '「第1・第3水曜はペットボトル」「月に1回の粗大ごみ」── PDF特有の複雑なルールもAIなら間違えません。年間分のスケジュールを一気に抽出します。',
    note: '見落としゼロで、ゴミ出し当日のリマインダーも自動設定',
    bgImage: '/anger_mother.webp',
  },
  {
    id: 'calendar',
    icon: '📅',
    step: '03',
    heading: 'PDFの予定をGoogleカレンダーに自動登録',
    body: '抽出したデータは、お使いのGoogleカレンダーに一括で自動登録されます。PDFに書かれた日付と予定なら何でもカレンダー登録できます。',
    note: 'ゴミ出しカレンダー以外のPDFにも対応',
    bgImage: '/calendar_mother.webp',
  },
  {
    id: 'cta',
    content: 'cta' as const,
    bgImage: '/enjoy_mother.webp',
  },
]

export function LandingPage() {
  return (
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
  )
}


function HeroSlide() {
  return (
    <div className="flex flex-col items-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl">♻️</span>
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
          <span className="text-teal-500 text-lg">✓</span> PDFをアップロードするだけ
        </p>
        <p className="flex items-center gap-2">
          <span className="text-teal-500 text-lg">✓</span> AIが自動でスケジュール抽出
        </p>
        <p className="flex items-center gap-2">
          <span className="text-teal-500 text-lg">✓</span> Googleカレンダーに一括登録
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
  icon: string
  step: string
  heading: string
  body: string
  note: string
}) {
  return (
    <div className="flex max-w-lg flex-col items-center gap-6 px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/70 text-4xl shadow-sm">
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
          <span className="text-4xl">🎉</span>
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
        <AdBanner slot="3248117735" />
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
