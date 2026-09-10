import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { isRevenueEventName, isSupportSource, isUuid, SUPPORT_AMOUNTS } from '@/lib/support'

type EventBody = {
  eventName?: unknown
  source?: unknown
  jobId?: unknown
  amount?: unknown
  milestoneKey?: unknown
}

const CLIENT_EVENT_NAMES = new Set([
  'support_cta_impression',
  'support_cta_click',
  'support_cta_dismissed',
])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as EventBody
    if (
      !isRevenueEventName(body.eventName) ||
      !CLIENT_EVENT_NAMES.has(body.eventName) ||
      !isSupportSource(body.source)
    ) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }

    const amount = typeof body.amount === 'number' &&
      SUPPORT_AMOUNTS.includes(body.amount as (typeof SUPPORT_AMOUNTS)[number])
      ? body.amount
      : null
    const requestedJobId = isUuid(body.jobId) ? body.jobId : null
    const milestoneKey = typeof body.milestoneKey === 'string'
      ? body.milestoneKey.slice(0, 80)
      : null

    const supabase = await getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (body.source !== 'donate_page' && !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let jobId: string | null = null
    if (requestedJobId && user) {
      const { data: job } = await supabase
        .from('jobs')
        .select('id')
        .eq('id', requestedJobId)
        .eq('user_id', user.id)
        .maybeSingle()
      jobId = job?.id ?? null
    }

    const serviceClient = getSupabaseServiceClient()
    const { error } = await serviceClient.from('revenue_events').insert({
      user_id: user?.id ?? null,
      job_id: jobId,
      event_name: body.eventName,
      source: body.source,
      amount,
      metadata: milestoneKey ? { milestone_key: milestoneKey } : {},
    })

    if (error) throw new Error(error.message)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.warn('[support] client event insert failed:', error)
    return NextResponse.json({ error: 'Event could not be recorded' }, { status: 500 })
  }
}
