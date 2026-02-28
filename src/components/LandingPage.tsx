'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Mousewheel, Pagination } from 'swiper/modules'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { useRef, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import 'swiper/css'
import 'swiper/css/pagination'
import { GoogleLoginButton } from './GoogleLoginButton'
import { AdBanner } from './AdBanner'
import { LanguageSwitcher } from './LanguageSwitcher'

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

export function LandingPage() {
  const t = useTranslations('landing')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const staticContentRef = useRef<HTMLDivElement>(null)

  const scrollToStatic = useCallback(() => {
    staticContentRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const isEn = locale === 'en'

  const slides = [
    {
      id: 'hero',
      content: 'hero' as const,
      bgImage: isEn ? '/gomi_mother_american.webp' : '/gomi_mother.png',
      bgImageSp: isEn ? '/gomi_mother_american_sp.webp' : '/gomi_mother_sp.webp',
    },
    {
      id: 'upload',
      icon: <IconFileText />,
      step: '01',
      heading: t('slides.upload.heading'),
      body: t('slides.upload.body'),
      note: t('slides.upload.note'),
      bgImage: isEn ? '/house_mother_american.webp' : '/house_mother.webp',
      bgImageSp: isEn ? '/house_mother_american_sp.webp' : '/house_mother_sp.webp',
    },
    {
      id: 'ai',
      icon: <IconBrain />,
      step: '02',
      heading: t('slides.ai.heading'),
      body: t('slides.ai.body'),
      note: t('slides.ai.note'),
      bgImage: isEn ? '/anger_mother_american.webp' : '/anger_mother.webp',
      bgImageSp: isEn ? '/anger_mother_american_sp.webp' : '/anger_mother_sp.webp',
    },
    {
      id: 'calendar',
      icon: <IconCalendar />,
      step: '03',
      heading: t('slides.calendar.heading'),
      body: t('slides.calendar.body'),
      note: t('slides.calendar.note'),
      bgImage: isEn ? '/calendar_mother_american.webp' : '/calendar_mother.webp',
      bgImageSp: isEn ? '/calendar_mother_american_sp.webp' : '/calendar_mother_sp.webp',
    },
    {
      id: 'cta',
      content: 'cta' as const,
      bgImage: isEn ? '/enjoy_mother_american.webp' : '/enjoy_mother.webp',
      bgImageSp: isEn ? '/enjoy_mother_american_sp.webp' : '/enjoy_mother_sp.webp',
    },
  ] satisfies Array<{
    id: string
    content?: 'hero' | 'cta'
    icon?: ReactNode
    step?: string
    heading?: string
    body?: string
    note?: string
    bgImage: string
    bgImageSp: string
  }>

  return (
    <div className="min-h-screen w-screen">
      {/* ナビゲーションヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-gray-100 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-teal-600">
          <IconRecycle className="w-5 h-5" />
          {tCommon('appName')}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-gray-500">
          <Link href="/faq" className="hover:text-teal-600 transition hidden sm:block">{t('header.faq')}</Link>
          <Link href="/terms" className="hover:text-teal-600 transition hidden sm:block">{t('header.terms')}</Link>
          <LanguageSwitcher />
          <GoogleLoginButton
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:shadow-md"
            label={t('header.login')}
          />
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
                {/* SP用背景画像 */}
                <Image
                  src={slide.bgImageSp}
                  alt=""
                  fill
                  className="block sm:hidden object-cover object-center opacity-[0.18]"
                  priority={i === 0}
                />
                {/* PC用背景画像 */}
                <Image
                  src={slide.bgImage}
                  alt=""
                  fill
                  className="hidden sm:block object-cover object-right opacity-[0.18]"
                  priority={i === 0}
                />
                <div className="relative z-10 flex h-full w-full items-center justify-center">
                  {slide.content === 'hero' ? (
                    <HeroSlide />
                  ) : slide.content === 'cta' ? (
                    <CtaSlide onScrollDown={scrollToStatic} />
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
      <div ref={staticContentRef}>
        <StaticContent />
      </div>
    </div>
  )
}


function StaticContent() {
  const t = useTranslations('landing.static')
  const tCommon = useTranslations('common')
  const faqItems = t.raw('faqSection.items') as Array<{ q: string; a: string }>

  return (
    <div className="bg-gray-50">
      {/* サービス詳細説明 */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t('whatIs.title')}</h2>
        <p className="text-center text-gray-500 text-sm mb-12">{t('whatIs.subtitle')}</p>
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="flex justify-center mb-4">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-teal-50 text-teal-500">
                <IconFileText className="w-7 h-7" />
              </span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">{t('whatIs.step1Title')}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('whatIs.step1Body')}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="flex justify-center mb-4">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-teal-50 text-teal-500">
                <IconBrain className="w-7 h-7" />
              </span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">{t('whatIs.step2Title')}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('whatIs.step2Body')}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="flex justify-center mb-4">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-teal-50 text-teal-500">
                <IconCalendar className="w-7 h-7" />
              </span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">{t('whatIs.step3Title')}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('whatIs.step3Body')}</p>
          </div>
        </div>
      </section>

      {/* 利用シーン */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t('useCases.title')}</h2>
          <p className="text-center text-gray-500 text-sm mb-12">{t('useCases.subtitle')}</p>
          <div className="grid gap-6 sm:grid-cols-3">
            {(t.raw('useCases.cases') as Array<{ icon: string; title: string; body: string }>).map((c, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
                <div className="text-3xl mb-3">{c.icon}</div>
                <h3 className="font-bold text-gray-800 mb-2 text-sm">{c.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ抜粋 */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t('faqSection.title')}</h2>
          <p className="text-center text-gray-500 text-sm mb-10">{t('faqSection.subtitle')}</p>
          <div className="space-y-4">
            {faqItems.map((faq, i) => (
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
              {t('faqSection.viewAll')}
            </Link>
          </div>

          <div className="mx-auto max-w-3xl pt-8 pb-4">
            <AdBanner slot="3248117735" format="horizontal" height={90} />
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t bg-gray-50 py-8 text-center text-xs text-gray-400">
        <div className="flex justify-center gap-6 mb-3">
          <Link href="/faq" className="hover:text-gray-600 transition">{t('footer.faq')}</Link>
          <Link href="/terms" className="hover:text-gray-600 transition">{t('footer.terms')}</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition">{t('footer.privacy')}</Link>
          <Link href="/legal" className="hover:text-gray-600 transition">{t('footer.legal')}</Link>
        </div>
        <p>{tCommon('copyright', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  )
}

function HeroSlide() {
  const t = useTranslations('landing')
  const tCommon = useTranslations('common')

  return (
    <div className="flex flex-col items-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-teal-50 text-teal-500">
          <IconRecycle className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          <span className="block">{tCommon('appName')}</span>
          <span className="mt-2 block text-2xl sm:text-3xl">{t('hero.subtitle')}</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600 sm:text-xl">
          {t('hero.description')}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 text-sm text-gray-500 font-medium">
        <p className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 text-white shrink-0">
            <IconCheck className="w-3 h-3" />
          </span>
          {t('hero.check1')}
        </p>
        <p className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 text-white shrink-0">
            <IconCheck className="w-3 h-3" />
          </span>
          {t('hero.check2')}
        </p>
        <p className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 text-white shrink-0">
            <IconCheck className="w-3 h-3" />
          </span>
          {t('hero.check3')}
        </p>
      </div>

      <GoogleLoginButton className="flex items-center gap-3 rounded-2xl bg-teal-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-teal-600 hover:shadow-xl active:scale-95" />

      <p className="text-xs font-bold text-teal-700 animate-bounce">
        {t('hero.scrollHint')}
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

function CtaSlide({ onScrollDown }: { onScrollDown?: () => void }) {
  const t = useTranslations('landing.slides.cta')
  const tCommon = useTranslations('common')

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
            {t('heading')}
          </h2>
          <p className="text-lg text-gray-500">
            {t('description')}
            <br />
            {t('description2')}
          </p>
        </div>

        <GoogleLoginButton className="flex items-center gap-3 rounded-2xl bg-teal-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-teal-600 hover:shadow-xl active:scale-95" />

        <div className="flex flex-col items-center gap-1 text-xs text-gray-400">
          <p>{t('free')}</p>
          <p>{t('easyLogin')}</p>
        </div>

        {/* 下のコンテンツへ誘導ボタン */}
        {onScrollDown && (
          <button
            onClick={onScrollDown}
            className="flex flex-col items-center gap-1 text-xs text-gray-400 hover:text-teal-500 transition"
            aria-label={t('moreAbout')}
          >
            <span>{t('moreAbout')}</span>
            <svg className="w-5 h-5 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </button>
        )}
      </div>

      <div className="w-full px-4 pb-2">
        <AdBanner slot="3248117735" format="horizontal" height={90} />
      </div>

      <footer className="w-full py-4 text-center text-xs text-teal-700/60">
        <div className="flex justify-center gap-4">
          <Link href="/terms" className="hover:text-teal-700 hover:underline">
            {tCommon('terms')}
          </Link>
          <Link href="/privacy" className="hover:text-teal-700 hover:underline">
            {tCommon('privacy')}
          </Link>
          <Link href="/legal" className="hover:text-teal-700 hover:underline">
            {tCommon('legal')}
          </Link>
        </div>
        <p className="mt-4">{tCommon('copyright', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  )
}
