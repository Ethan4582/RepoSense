import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "~/server/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-07-30.basil'
});

export async function POST(request: Request) {
    const body = await request.text()
    const signature = (await headers()).get('Stripe-Signature') as string
    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const session = event.data.object as Stripe.Checkout.Session
    console.log('Event Type', event.type)
    console.log('Stripe webhook event:', event.type, session);

    if (event.type === 'checkout.session.completed') {
        const credits = Number(session.metadata?.['credits']);
        const userId = session.client_reference_id;
        console.log('Webhook received for user:', userId, 'credits:', credits);
        const amount = session.amount_total ? Math.round(session.amount_total) : 0; // Stripe sends amount in cents

        if (!userId || !credits) {
            console.error('Missing userId or credits in webhook');
            return NextResponse.json({ error: 'Missing userId or credits' }, { status: 400 });
        }

      await db.stripeTransactions.create({ data: { userId, credit: credits, amount } })

        await db.user.update({
            where: { id: userId }, 
            data: {
                credits: {
                    increment: credits // increase the current user by +x 
                }
            }
        });
          return NextResponse.json({ message: 'Credits added successfully' } , {status: 200})
    }


    return NextResponse.json({ message: 'Hello, world!' })
    
}