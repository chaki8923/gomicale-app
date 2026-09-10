import 'server-only'

import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient

  const apiKey = process.env.STRIPE_RESTRICTED_KEY ?? process.env.STRIPE_SECRET_KEY
  if (!apiKey) throw new Error('Stripe is not configured')

  stripeClient = new Stripe(apiKey)
  return stripeClient
}
