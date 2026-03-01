import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { getBlogPost } from '@/lib/microcms'
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
      alternates: {
        canonical: `/${locale}/blog/${id}`,
        languages: {
          ja: `/ja/blog/${id}`,
          en: `/en/blog/${id}`,
        },
      },
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

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: tCommon('topPage'),
        item: `https://gomicale.jp/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'ブログ',
        item: `https://gomicale.jp/${locale}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `https://gomicale.jp/${locale}/blog/${id}`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/servise_logo.webp" alt={tCommon('appName')} width={300} height={80} className="h-16 w-auto object-contain" priority />
            </Link>
            <div className="flex items-center gap-4">
              <nav className="flex items-center gap-6 text-sm text-gray-500">
                <Link href="/blog" className="hover:text-gray-700 transition">ブログ</Link>
                <Link href="/faq" className="hover:text-gray-700 transition">{tCommon('faq')}</Link>
              </nav>
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

          <div className="mt-12 flex flex-col items-center gap-4">
            <p className="text-sm font-bold text-gray-500">この記事をシェアする</p>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?url=https://gomicale.jp/${locale}/blog/${post.id}&text=${encodeURIComponent(post.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DA1F2] text-white transition hover:bg-[#1a91da]"
                aria-label="X (Twitter) でシェア"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=https://gomicale.jp/${locale}/blog/${post.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2] text-white transition hover:bg-[#166fe5]"
                aria-label="Facebookでシェア"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>

          <div className="mt-12 text-center">
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
