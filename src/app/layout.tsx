import "~/styles/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
  title: "RepoSense - AI Codebase Intelligence",
  description: "AI-powered repository exploration, semantic vector grounding, and deep architectural insights.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "RepoSense - AI Codebase Intelligence",
    description: "AI-powered repository exploration, semantic vector grounding, and deep architectural insights.",
    url: "https://reposense.dev",
    siteName: "RepoSense",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "RepoSense Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RepoSense - AI Codebase Intelligence",
    description: "AI-powered repository exploration, semantic vector grounding, and deep architectural insights.",
    images: ["/logo.png"],
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geist.variable}`}>
        <body>
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
