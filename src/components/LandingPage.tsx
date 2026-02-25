'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Mousewheel, Pagination } from 'swiper/modules'
import Link from 'next/link'
import Image from 'next/image'
import 'swiper/css'
import 'swiper/css/pagination'
import { GoogleLoginButton } from './GoogleLoginButton'

const slides = [
  {
    id: 'hero',
    content: 'hero' as const,
  },
  {
    id: 'upload',
    icon: '📄',
    step: '01',
    heading: 'PDFをアップロードするだけ',
    body: '自治体から配られるゴミ出しカレンダーPDFをドラッグ＆ドロップするだけ。複雑なレイアウトも、AIが自動で読み解きます。',
    note: '手入力や転記ミスはもう不要',
  },
  {
    id: 'ai',
    icon: '🤖',
    step: '02',
    heading: 'AIが複雑なルールも正確に解析',
    body: '「第1・第3水曜はペットボトル」「月に1回の粗大ごみ」── ルールが複雑でもAIなら間違えません。年間分のスケジュールを一気に抽出します。',
    note: '見落としゼロで、ゴミ出し当日のリマインダーも自動設定',
  },
  {
    id: 'calendar',
    icon: '📅',
    step: '03',
    heading: 'Googleカレンダーに自動登録',
    body: 'ゴミ出しだけでなく、学校行事や地域のイベント予定表など、日付と予定が書かれたPDFなら何でもカレンダーに一括登録できます。',
    note: 'ゴミ出しカレンダー以外のPDFにも対応',
  },
  {
    id: 'cta',
    content: 'cta' as const,
  },
]

export function LandingPage() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Image
        src="/gomi_mother.png"
        alt=""
        fill
        className="object-cover opacity-[0.18]"
        priority
      />
      <Swiper
        modules={[Mousewheel, Pagination]}
        direction="vertical"
        slidesPerView={1}
        mousewheel={{ sensitivity: 1, thresholdDelta: 30 }}
        pagination={{ clickable: true }}
        speed={700}
        className="relative z-10 h-full w-full"
        style={
          {
            '--swiper-pagination-color': '#0d9488',
            '--swiper-pagination-bullet-inactive-color': '#9ca3af',
            '--swiper-pagination-bullet-inactive-opacity': '0.5',
          } as React.CSSProperties
        }
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id}>
            <div
              className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-50/90 to-teal-100/90"
            >
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
          ゴミカレ
        </h1>
        <p className="mt-2 text-lg text-gray-500 sm:text-xl">
          ゴミ出しカレンダーを
          <br className="sm:hidden" />
          Googleカレンダーに自動登録
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 text-sm text-gray-400">
        <p className="flex items-center gap-2">
          <span className="text-teal-500">✓</span> PDFをアップロードするだけ
        </p>
        <p className="flex items-center gap-2">
          <span className="text-teal-500">✓</span> AIが自動でスケジュール抽出
        </p>
        <p className="flex items-center gap-2">
          <span className="text-teal-500">✓</span> Googleカレンダーに一括登録
        </p>
      </div>

      <GoogleLoginButton className="flex items-center gap-3 rounded-2xl bg-teal-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-teal-600 hover:shadow-xl active:scale-95" />

      <p className="text-xs text-gray-400">
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

      <footer className="w-full py-6 text-center text-xs text-teal-700/60">
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
