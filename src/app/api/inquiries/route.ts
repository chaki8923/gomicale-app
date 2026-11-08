import { submitInquiry } from '@/lib/inquiry-server'

export const runtime = 'nodejs'
export const maxDuration = 30
export const POST = (request: Request) => submitInquiry(request)
