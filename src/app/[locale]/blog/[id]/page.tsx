import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getBlogPost } from '@/lib/microcms'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

type Props = {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  try {
    const post = await getBlogPost(id)
    const description = post.content.replace(/<[^>]+>/g, '').slice(0, 120)
    return {
      title: post.title,
      description,
      openGraph: {
        title: post.title,
        description,
        type: 'article',
        publishedTime: post.publishedAt,
        ...(post.eyecatch && {
          images: [{ url: post.eyecatch.url, width: post.eyecatch.width, height: post.eyecatch.height }],
        }),
      },
    }
  } catch {
    return { title: '記事が見つかりません' }
  }
}


export default async function BlogPostPage({ params }: Props) {
  const { id, locale } = await params
  const tCommon = await getTranslations({ locale, namespace: 'common' })

  let post = null
  try {
    post = await getBlogPost(id)
  } catch {
    notFound()
  }

  const description = post.content.replace(/<[^>]+>/g, '').slice(0, 120)

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description,
    datePublished: post.publishedAt,
    dateModified: post.revisedAt,
    author: { '@type': 'Organization', name: 'ゴミカレ' },
    publisher: {
      '@type': 'Organization',
      name: 'ゴミカレ',
      logo: { '@type': 'ImageObject', url: 'https://gomicale.jp/favicon.ico' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://gomicale.jp/blog/${id}` },
    ...(post.eyecatch && { image: post.eyecatch.url }),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-teal-600">
              {tCommon('appName')}
            </Link>
            <div className="flex items-center gap-4">
              <nav className="flex items-center gap-6 text-sm text-gray-500">
                <Link href="/blog" className="hover:text-gray-700 transition">ブログ</Link>
                <Link href="/faq" className="hover:text-gray-700 transition">{tCommon('faq')}</Link>
              </nav>
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <article className="container mx-auto px-4 py-12 max-w-3xl">
          <nav className="text-xs text-gray-400 mb-6 flex items-center gap-2">
            <Link href="/" className="hover:text-gray-600 transition">{tCommon('topPage')}</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-gray-600 transition">ブログ</Link>
            <span>/</span>
            <span className="text-gray-600 truncate">{post.title}</span>
          </nav>

          <header className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <time className="text-xs text-gray-400">
                {new Date(post.publishedAt).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              {post.category && (
                <span className="rounded-full bg-teal-50 px-3 py-0.5 text-xs font-medium text-teal-600">
                  {post.category.name}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 leading-snug">{post.title}</h1>
          </header>

          {post.eyecatch && (
            <div className="mb-8 overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.eyecatch.url}
                alt={post.title}
                width={post.eyecatch.width}
                height={post.eyecatch.height}
                className="w-full object-cover"
              />
            </div>
          )}

          <div
            className="bg-white rounded-2xl shadow-sm p-8 prose prose-teal max-w-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-gray-800 [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:text-gray-600 [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_li]:text-gray-600 [&_li]:mb-1 [&_a]:text-teal-600 [&_a]:underline [&_strong]:font-bold [&_strong]:text-gray-800 [&_figure]:my-6 [&_figure_img]:rounded-xl [&_figure_img]:w-full"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          <div className="mt-10 text-center">
            <Link
              href="/blog"
              className="inline-block rounded-xl border border-teal-500 px-6 py-3 text-sm font-semibold text-teal-600 hover:bg-teal-50 transition"
            >
              ← ブログ一覧に戻る
            </Link>
          </div>
        </article>

        <footer className="mt-16 border-t bg-white py-6 text-center text-xs text-gray-400">
          <div className="flex justify-center gap-6 mb-3">
            <Link href="/" className="hover:text-gray-600 transition">{tCommon('topPage')}</Link>
            <Link href="/blog" className="hover:text-gray-600 transition">ブログ</Link>
            <Link href="/faq" className="hover:text-gray-600 transition">{tCommon('faq')}</Link>
            <Link href="/terms" className="hover:text-gray-600 transition">{tCommon('terms')}</Link>
            <Link href="/privacy" className="hover:text-gray-600 transition">{tCommon('privacy')}</Link>
          </div>
          <p>{tCommon('copyright', { year: new Date().getFullYear() })}</p>
        </footer>
      </div>
    </>
  )
}
