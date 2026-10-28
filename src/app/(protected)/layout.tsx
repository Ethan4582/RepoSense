"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "~/components/ui/sidebar";
import { AppSideBar } from "../app-sidebar";
import { GlobalCommandPalette } from "~/components/global-command-palette";
import { NotificationCenter } from "~/components/notification-center";

type Props = {
  children: React.ReactNode;
};

export default function SideBarLayout({ children }: Props) {
  return (
    <SidebarProvider>
      <div className="bg-background flex min-h-screen w-full">
        <GlobalCommandPalette />
        <React.Suspense fallback={null}>
          <AppSideBar />
        </React.Suspense>
        <main className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="bg-background/95 sticky top-0 z-10 flex h-12 shrink-0 items-center justify-end border-b px-4 backdrop-blur">
            <NotificationCenter />
          </header>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
