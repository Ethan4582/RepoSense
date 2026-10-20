import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
]);

export default clerkMiddleware(async (auth, req) => {
  const url = new URL(req.url);

  // If user visits the root path "/"
  if (url.pathname === "/") {
    const { userId } = await auth();
    // If already logged in, go straight to the internal dashboard
    if (userId) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    // If unauthenticated and a landing page URL is defined, redirect there
    const landingUrl = process.env.NEXT_PUBLIC_LANDING_PAGE_URL;
    if (landingUrl) {
      return NextResponse.redirect(new URL(landingUrl));
    }
    // Default fallback to sign-in
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
