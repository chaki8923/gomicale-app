import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient } from '@/lib/stripe'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import {
  isSupportSource,
  isUuid,
  SUPPORT_AMOUNTS,
  type SupportSource,
} from '@/lib/support'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gomicale.jp'

type CheckoutBody = {
  amount?: number
  source?: unknown
  jobId?: unknown
  locale?: unknown
}

function createIntegrationIdentifier() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  return Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CheckoutBody
    const amount = body.amount
    const requestedSource: SupportSource = isSupportSource(body.source) ? body.source : 'donate_page'
    const locale = body.locale === 'en' ? 'en' : 'ja'
    const requestedJobId = isUuid(body.jobId) ? body.jobId : null

    if (!amount || !SUPPORT_AMOUNTS.includes(amount as (typeof SUPPORT_AMOUNTS)[number])) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const source: SupportSource = user ? requestedSource : 'donate_page'

    let jobId: string | null = null
    if (requestedJobId) {
      if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

      const { data: job } = await supabase
        .from('jobs')
        .select('id')
        .eq('id', requestedJobId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      jobId = job.id
    }

    const metadata: Record<string, string> = {
      gomicale_payment: 'development_support',
      source,
      locale,
    }
    if (user) metadata.user_id = user.id
    if (jobId) metadata.job_id = jobId

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      integration_identifier: createIntegrationIdentifier(),
      client_reference_id: user?.id,
      customer_email: user?.email,
      metadata,
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            unit_amount: amount,
            product_data: {
              name: locale === 'en' ? 'GomiCale development support' : 'ゴミカレ 開発支援',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/${locale}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/${locale}/donate?source=${source}${jobId ? `&jobId=${jobId}` : ''}`,
    })

    const serviceClient = getSupabaseServiceClient()
    const { error: paymentError } = await serviceClient.from('support_payments').insert({
      user_id: user?.id ?? null,
      job_id: jobId,
      stripe_session_id: session.id,
      amount,
      currency: session.currency ?? 'jpy',
      status: 'pending',
      source,
      locale,
    })

    if (paymentError) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined)
      throw new Error(`Failed to create support ledger: ${paymentError.message}`)
    }

    const { error: eventError } = await serviceClient.from('revenue_events').insert({
      user_id: user?.id ?? null,
      job_id: jobId,
      stripe_session_id: session.id,
      event_name: 'checkout_created',
      source,
      amount,
    })

    if (eventError) console.warn('[support] checkout event insert failed:', eventError.message)

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[support] checkout creation failed:', error)
    return NextResponse.json({ error: 'Checkout could not be started' }, { status: 500 })
  }
}
