import { createClient } from 'microcms-js-sdk'

function getMicrocmsClient() {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
  const apiKey = process.env.MICROCMS_API_KEY
  if (!serviceDomain || !apiKey) {
    throw new Error('MicroCMS environment variables are not set')
  }
  return createClient({ serviceDomain, apiKey })
}

export type BlogCategory = {
  id: string
  name: string
}

export type BlogPost = {
  id: string
  createdAt: string
  updatedAt: string
  publishedAt: string
  revisedAt: string
  title: string
  content: string
  eyecatch?: {
    url: string
    width: number
    height: number
  }
  category?: BlogCategory
}

export type BlogListResponse = {
  contents: BlogPost[]
  totalCount: number
  offset: number
  limit: number
}

export async function getBlogList(options?: {
  limit?: number
  offset?: number
}): Promise<BlogListResponse> {
  return getMicrocmsClient().get<BlogListResponse>({
    endpoint: 'blog',
    queries: {
      limit: options?.limit ?? 10,
      offset: options?.offset ?? 0,
      orders: '-publishedAt',
    },
  })
}

export async function getBlogPost(id: string): Promise<BlogPost> {
  return getMicrocmsClient().get<BlogPost>({
    endpoint: 'blog',
    contentId: id,
  })
}

export async function getAllBlogIds(): Promise<string[]> {
  const data = await getMicrocmsClient().get<BlogListResponse>({
    endpoint: 'blog',
    queries: { limit: 100, fields: 'id' },
  })
  return data.contents.map((post) => post.id)
}
