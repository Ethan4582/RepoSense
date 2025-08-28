import { NextResponse } from "next/server";
import { createCheckoutSession } from "~/lib/stripe";

export async function POST(request: Request) {
  const { credits } = await request.json();
  const session = await createCheckoutSession(credits);
  return NextResponse.json({ url: session.url });
}