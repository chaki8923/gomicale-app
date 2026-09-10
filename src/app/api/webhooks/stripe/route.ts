import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeClient } from '@/lib/stripe'
import { isGomicaleSupportSession, persistSupportSession } from '@/lib/support-server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const body = await request.text()
    event = getStripeClient().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.warn('[support] invalid Stripe webhook:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        if (!isGomicaleSupportSession(event.data.object)) break
        await persistSupportSession(event.data.object)
        break
      }
      case 'checkout.session.async_payment_succeeded':
        if (!isGomicaleSupportSession(event.data.object)) break
        await persistSupportSession(event.data.object, 'paid')
        break
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        if (!isGomicaleSupportSession(event.data.object)) break
        await persistSupportSession(event.data.object, 'failed')
        break
      default:
        break
    }
  } catch (error) {
    console.error(`[support] Stripe webhook ${event.id} failed:`, error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
