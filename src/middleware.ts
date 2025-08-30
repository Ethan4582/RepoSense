import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  './api/webhook/stripe(.*)'
  // '/sync-user(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) {
    await auth.protect()
  }
   const url = new URL(req.url);

  // Redirect ONLY if the user is on the root path "/"
  if (url.pathname === "/") {
    return NextResponse.redirect("https://reposense.framer.website/");
  }

  // Allow all other routes
  return NextResponse.next();

})

// export function middleware(request: Request) {
//   const url = new URL(request.url);

//   // Redirect ONLY if the user is on the root path "/"
//   if (url.pathname === "/") {
//     return NextResponse.redirect("https://reposense.framer.website/");
//   }

//   // Allow all other routes
//   return NextResponse.next();
// }

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};