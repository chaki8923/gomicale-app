import type { MetadataRoute } from 'next'
import { getBlogList } from '@/lib/microcms'

const BASE_URL = 'https://gomicale.jp'
const locales = ['ja', 'en']

function getAlternates(path: string) {
  return {
    languages: {
      ja: `${BASE_URL}/ja${path}`,
      en: `${BASE_URL}/en${path}`,
    },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    { path: '', priority: 1.0, changeFrequency: 'monthly' as const },
    { path: '/blog', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/faq', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/legal', priority: 0.3, changeFrequency: 'yearly' as const },
  ]

  const staticRoutes: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `${BASE_URL}/${locale}${route.path}`,
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: getAlternates(route.path),
    }))
  )

  staticRoutes.push({
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 1.0,
    alternates: getAlternates(''),
  })

  let blogRoutes: MetadataRoute.Sitemap = []
  try {
    const data = await getBlogList({ limit: 100 })
    blogRoutes = locales.flatMap((locale) =>
      data.contents.map((post) => ({
        url: `${BASE_URL}/${locale}/blog/${post.id}`,
        lastModified: new Date(post.revisedAt),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
        alternates: getAlternates(`/blog/${post.id}`),
      }))
    )
  } catch {
    // MicroCMS が未設定の場合は無視
  }

  return [...staticRoutes, ...blogRoutes]
}
