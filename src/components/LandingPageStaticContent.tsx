import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { AdBanner } from './AdBanner'
import type { BlogPost } from '@/lib/microcms'

// ─── SVG アイコン ───────────────────────────────────────────
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

type Props = {
  blogPosts?: BlogPost[]
}

export function LandingPageStaticContent({ blogPosts = [] }: Props) {
  const t = useTranslations('landing.static')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const faqItems = t.raw('faqSection.items') as Array<{ q: string; a: string }>

  return (
    <div className="bg-gray-50" id="static-content">
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
        <div className="mt-10 rounded-xl bg-white/80 p-6 text-center">
          <p className="text-sm text-gray-600 leading-relaxed">{t('whatIs.technicalNote')}</p>
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

      {/* ブログ記事一覧 */}
      {blogPosts.length > 0 && (
        <section className="bg-white py-20">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{t('blogSection.title')}</h2>
            <p className="text-center text-gray-500 text-sm mb-12">{t('blogSection.subtitle')}</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {blogPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.id}`}
                  className="block bg-gray-50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition group"
                >
                  {post.eyecatch ? (
                    <div className="aspect-video relative overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.eyecatch.url}
                        alt=""
                        width={post.eyecatch.width}
                        height={post.eyecatch.height}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-teal-100 flex items-center justify-center">
                      <span className="text-4xl text-teal-300">📄</span>
                    </div>
                  )}
                  <div className="p-5">
                    <time className="text-xs text-gray-400">
                      {new Date(post.publishedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                    <h3 className="mt-2 font-bold text-gray-800 group-hover:text-teal-600 transition line-clamp-2">
                      {post.title}
                    </h3>
                    {post.content && (
                      <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                        {post.content.replace(/<[^>]+>/g, '').slice(0, 80)}…
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/blog"
                className="inline-block rounded-xl border border-teal-500 px-6 py-3 text-sm font-semibold text-teal-600 hover:bg-teal-50 transition"
              >
                {t('blogSection.viewAll')}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* メリット */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">{t('benefits.title')}</h2>
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-teal-600 mb-3">{t('benefits.point1.title')}</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{t('benefits.point1.body')}</p>
              <p className="mt-4 text-sm text-gray-600 leading-relaxed">{t('benefits.point1.extend')}</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-teal-600 mb-3">{t('benefits.point2.title')}</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{t('benefits.point2.body')}</p>
              <p className="mt-4 text-sm text-gray-600 leading-relaxed">{t('benefits.point2.extend')}</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-teal-600 mb-3">{t('benefits.point3.title')}</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{t('benefits.point3.body')}</p>
              <p className="mt-4 text-sm text-gray-600 leading-relaxed">{t('benefits.point3.extend')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 開発ストーリー / About */}
      <section className="bg-teal-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-teal-500"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('about.title')}</h2>
            <p className="text-teal-600 font-semibold text-sm mb-8">{t('about.subtitle')}</p>
            <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
              <p>{t('about.body1')}</p>
              <p className="font-semibold text-gray-900 bg-gray-50 p-4 rounded-xl border-l-4 border-gray-300">
                {t('about.body2')}
              </p>
              <p>{t('about.body3')}</p>
              <p>{t('about.body4')}</p>
            </div>
            <div className="mt-8 flex items-center justify-end gap-3 text-xs text-gray-500">
              <span className="w-8 h-[1px] bg-gray-300"></span>
              {t('about.author')}
            </div>
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
        <div className="flex flex-wrap justify-center gap-6 px-4 mb-3">
          <Link href="/blog" className="hover:text-gray-600 transition">{tCommon('blog')}</Link>
          <Link href="/faq" className="hover:text-gray-600 transition">{tCommon('faq')}</Link>
          <Link href="/about" className="hover:text-gray-600 transition">{tCommon('about')}</Link>
          <Link href="/contact" className="hover:text-gray-600 transition">{tCommon('contact')}</Link>
          <Link href="/terms" className="hover:text-gray-600 transition">{tCommon('terms')}</Link>
          <Link href="/privacy" className="hover:text-gray-600 transition">{tCommon('privacy')}</Link>
          <Link href="/legal" className="hover:text-gray-600 transition">{tCommon('legal')}</Link>
        </div>
        <p>{tCommon('copyright', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  )
}
