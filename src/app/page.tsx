'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const landingUrl = process.env.NEXT_PUBLIC_LANDING_PAGE_URL;
    if (landingUrl && landingUrl.startsWith("http")) {
      window.location.href = landingUrl;
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </main>
  );
}
