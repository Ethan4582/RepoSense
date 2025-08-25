
'use server'

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/dist/server/api-utils';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});


export async function createCheckoutSession(credits: number) {
    const { userId } = await auth()
    if (!userId) {
        throw new Error('Unauthorized')
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `${credits} Reposense Credits`
                    },
                    unit_amount: Math.round((credits / 50) * 100)
                },
                quantity: 1
            }
        ],
        customer_creation: 'always',
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
        client_reference_id: userId.toString(),
        metadata: {
            credits: credits
        }
    })

    return redirect(session.url)
}