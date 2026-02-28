import { createClient } from 'microcms-js-sdk'

export const microcmsClient = createClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN!,
  apiKey: process.env.MICROCMS_API_KEY!,
})

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
  return microcmsClient.get<BlogListResponse>({
    endpoint: 'blog',
    queries: {
      limit: options?.limit ?? 10,
      offset: options?.offset ?? 0,
      orders: '-publishedAt',
    },
  })
}

export async function getBlogPost(id: string): Promise<BlogPost> {
  return microcmsClient.get<BlogPost>({
    endpoint: 'blog',
    contentId: id,
  })
}

export async function getAllBlogIds(): Promise<string[]> {
  const data = await microcmsClient.get<BlogListResponse>({
    endpoint: 'blog',
    queries: { limit: 100, fields: 'id' },
  })
  return data.contents.map((post) => post.id)
}
