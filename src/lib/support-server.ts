import 'server-only'

import type Stripe from 'stripe'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe'
import { isSupportSource, isUuid, type SupportSource } from '@/lib/support'

export type FulfilledSupportPayment = {
  paid: boolean
  amount: number | null
  currency: string | null
  source: SupportSource
}

export function hasSupportCooldownExpired(paidAt: string | null, days = 180) {
  if (!paidAt) return true
  return new Date(paidAt).getTime() < Date.now() - days * 24 * 60 * 60 * 1000
}

function getSessionIdentity(session: Stripe.Checkout.Session) {
  const userIdCandidate = session.metadata?.user_id ?? session.client_reference_id
  const jobIdCandidate = session.metadata?.job_id

  return {
    userId: isUuid(userIdCandidate) ? userIdCandidate : null,
    jobId: isUuid(jobIdCandidate) ? jobIdCandidate : null,
    source: isSupportSource(session.metadata?.source) ? session.metadata.source : 'donate_page' as const,
    locale: session.metadata?.locale === 'en' ? 'en' as const : 'ja' as const,
  }
}

export function isGomicaleSupportSession(session: Stripe.Checkout.Session) {
  return session.metadata?.gomicale_payment === 'development_support'
}

export async function persistSupportSession(
  session: Stripe.Checkout.Session,
  forcedStatus?: 'paid' | 'failed',
): Promise<FulfilledSupportPayment> {
  if (!isGomicaleSupportSession(session)) {
    throw new Error(`Stripe session ${session.id} is not a GomiCale support payment`)
  }

  const serviceClient = getSupabaseServiceClient()
  const identity = getSessionIdentity(session)
  const amount = session.amount_total
  const paid = forcedStatus === 'paid' || (forcedStatus !== 'failed' && session.payment_status !== 'unpaid')
  const status = paid ? 'paid' : forcedStatus === 'failed' ? 'failed' : 'pending'
  const paidAt = paid ? new Date().toISOString() : null

  if (amount == null || amount <= 0) {
    throw new Error(`Stripe session ${session.id} has no positive amount_total`)
  }

  const { data: existingPayment, error: existingError } = await serviceClient
    .from('support_payments')
    .select('status, paid_at')
    .eq('stripe_session_id', session.id)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to read support payment: ${existingError.message}`)
  }

  // 遅れて届いた expired 通知や success ページの再読込で paid を巻き戻さない。
  const persistedStatus = existingPayment?.status === 'paid' ? 'paid' : status
  const persistedPaidAt = existingPayment?.status === 'paid'
    ? existingPayment.paid_at
    : paidAt

  const { error: paymentError } = await serviceClient
    .from('support_payments')
    .upsert({
      user_id: identity.userId,
      job_id: identity.jobId,
      stripe_session_id: session.id,
      amount,
      currency: session.currency ?? 'jpy',
      status: persistedStatus,
      source: identity.source,
      locale: identity.locale,
      paid_at: persistedPaidAt,
    }, { onConflict: 'stripe_session_id' })

  if (paymentError) throw new Error(`Failed to persist support payment: ${paymentError.message}`)

  if (persistedStatus === 'paid' || persistedStatus === 'failed') {
    const { error: eventError } = await serviceClient.from('revenue_events').insert({
      user_id: identity.userId,
      job_id: identity.jobId,
      stripe_session_id: session.id,
      event_name: persistedStatus === 'paid' ? 'payment_completed' : 'payment_failed',
      source: identity.source,
      amount,
    })

    // Stripeの再送やsuccessページとの競合による重複は正常扱い。
    if (eventError && eventError.code !== '23505') {
      console.warn('[support] revenue event insert failed:', eventError.message)
    }
  }

  return {
    paid: persistedStatus === 'paid',
    amount,
    currency: session.currency,
    source: identity.source,
  }
}

export async function fulfillSupportSession(sessionId: string): Promise<FulfilledSupportPayment> {
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9_]+$/.test(sessionId)) {
    return { paid: false, amount: null, currency: null, source: 'donate_page' }
  }

  const serviceClient = getSupabaseServiceClient()
  const { data: knownPayment, error } = await serviceClient
    .from('support_payments')
    .select('source')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()

  if (error) throw new Error(`Failed to verify support session: ${error.message}`)
  if (!knownPayment) {
    return { paid: false, amount: null, currency: null, source: 'donate_page' }
  }

  const session = await getStripeClient().checkout.sessions.retrieve(sessionId)
  if (!isGomicaleSupportSession(session)) {
    return { paid: false, amount: null, currency: null, source: 'donate_page' }
  }
  return persistSupportSession(session)
}
