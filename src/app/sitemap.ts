import type { MetadataRoute } from 'next'
import { getBlogList } from '@/lib/microcms'

const BASE_URL = 'https://gomicale.jp'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  let blogRoutes: MetadataRoute.Sitemap = []
  try {
    const data = await getBlogList({ limit: 100 })
    blogRoutes = data.contents.map((post) => ({
      url: `${BASE_URL}/blog/${post.id}`,
      lastModified: new Date(post.revisedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  } catch {
    // MicroCMS が未設定の場合は無視
  }

  return [...staticRoutes, ...blogRoutes]
}
