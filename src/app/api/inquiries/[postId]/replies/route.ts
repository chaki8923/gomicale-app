import { submitInquiry } from '@/lib/inquiry-server'

export const runtime = 'nodejs'
export const maxDuration = 30
export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  const { postId } = await context.params
  return submitInquiry(request, postId)
}
