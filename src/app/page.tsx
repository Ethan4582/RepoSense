'use client';

import { Button } from "~/components/ui/button";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("https://reposense.framer.website/");
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Welcome to My App</h1>
      <Button >
        Click Me
      </Button>
    </main>
  );
}
