import type { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import { getBlogList } from '@/lib/microcms'
import { getTranslations } from 'next-intl/server'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return {
    title: 'ブログ',
    description: 'PDFのGoogleカレンダー取り込みやゴミ出しカレンダーの活用方法など、役立つ情報をお届けするゴミカレ公式ブログ。',
    alternates: {
      canonical: `/${locale}/blog`,
      languages: {
        ja: '/ja/blog',
        en: '/en/blog',
      },
    },
  }
}

export const revalidate = 3600

export default async function BlogListPage({ params }: Props) {
  const { locale } = await params
  const tCommon = await getTranslations({ locale, namespace: 'common' })

  let posts = null
  let error = false
  try {
    const data = await getBlogList({ limit: 20 })
    posts = data.contents
  } catch {
    error = true
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/servise_logo.webp" alt={tCommon('appName')} width={300} height={80} className="h-16 w-auto object-contain" priority />
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/blog" className="text-teal-600 font-medium">ブログ</Link>
              <Link href="/faq" className="hover:text-gray-700 transition">{tCommon('faq')}</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ブログ</h1>
        <p className="text-gray-500 mb-10">PDFカレンダーの活用方法やゴミ出しの豆知識をお届けします。</p>

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-700">
            記事を読み込めませんでした。しばらく経ってからお試しください。
          </div>
        )}

        {posts && posts.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
            記事はまだありません。
          </div>
        )}

        {posts && posts.length > 0 && (
          <div className="space-y-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.id}`}
                className="block bg-white rounded-2xl shadow-sm hover:shadow-md transition p-6 group"
              >
                <div className="flex flex-col gap-3">
                  <time className="text-xs text-gray-400">
                    {new Date(post.publishedAt).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <h2 className="text-lg font-bold text-gray-900 group-hover:text-teal-600 transition leading-snug">
                    {post.title}
                  </h2>
                  {post.content && (
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">
                      {post.content.replace(/<[^>]+>/g, '').slice(0, 120)}
                    </p>
                  )}
                  <span className="text-xs font-semibold text-teal-500 group-hover:underline">
                    続きを読む →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

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
  )
}
