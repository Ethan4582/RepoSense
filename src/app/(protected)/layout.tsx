"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { AppSideBar } from "../app-sidebar";
import { GlobalCommandPalette } from "~/components/global-command-palette";
import { NotificationCenter } from "~/components/notification-center";
import useProject from "~/hooks/use-project";
import { Separator } from "~/components/ui/separator";

type Props = {
  children: React.ReactNode;
};

export default function SideBarLayout({ children }: Props) {
  const pathname = usePathname();
  const { project } = useProject();
  const pageTitle =
    pathname === "/dashboard"
      ? "Dashboard"
      : pathname.startsWith("/settings/projects/")
        ? "Updates & access"
        : pathname.startsWith("/settings")
          ? "API keys & models"
          : pathname.startsWith("/history")
            ? "Question history"
            : pathname.startsWith("/qa")
              ? "Saved answers"
              : pathname.startsWith("/pull")
                ? "Pull requests"
                : pathname.startsWith("/meetings")
                  ? "Meetings"
                  : pathname.startsWith("/create")
                    ? "New wiki"
                    : "Workspace";

  return (
    <SidebarProvider>
      <div className="internal-app bg-background flex min-h-screen w-full">
        <GlobalCommandPalette />
        <React.Suspense fallback={null}>
          <AppSideBar />
        </React.Suspense>
        <SidebarInset className="h-screen min-w-0 overflow-y-auto">
          <header className="bg-background/90 border-border/60 sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b px-3 backdrop-blur sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="font-medium">{pageTitle}</span>
                {project ? (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground truncate">
                      {project.name}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <NotificationCenter />
          </header>
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
