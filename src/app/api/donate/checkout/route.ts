import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const VALID_AMOUNTS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500]
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gomicale.jp'

export async function POST(request: NextRequest) {
  const body = await request.json() as { amount?: number }
  const amount = body.amount

  if (!amount || !VALID_AMOUNTS.includes(amount)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const stripe = new Stripe(secretKey)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          unit_amount: amount,
          product_data: { name: 'ゴミカレ 開発支援寄付' },
        },
        quantity: 1,
      },
    ],
    success_url: `${APP_URL}/ja/donate/success`,
    cancel_url: `${APP_URL}/ja/donate`,
  })

  return NextResponse.json({ url: session.url })
}
