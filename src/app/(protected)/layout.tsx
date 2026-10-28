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
import { AccountMenu } from "~/components/account-menu";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

type Props = {
  children: React.ReactNode;
};

export default function SideBarLayout({ children }: Props) {
  const pathname = usePathname();
  const { project, projects } = useProject();
  const projectIdFromPath = pathname.match(
    /\/settings\/projects\/([^/]+)/,
  )?.[1];
  const breadcrumbProject =
    projects?.find((item) => item.id === projectIdFromPath) ?? project;
  const pageTitle =
    pathname === "/dashboard"
      ? "Dashboard"
      : pathname.includes("/revisions/")
        ? "Revision diff"
        : pathname.startsWith("/settings/projects/")
          ? "Project settings"
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
  const isProjectSettings = pathname.startsWith("/settings/projects/");
  const isDashboard = pathname === "/dashboard";

  return (
    <SidebarProvider>
      <div className="internal-app bg-background flex min-h-screen w-full">
        <GlobalCommandPalette />
        <React.Suspense fallback={null}>
          <AppSideBar />
        </React.Suspense>
        <SidebarInset className="h-screen min-w-0 scrollbar-none overflow-y-auto">
          <header className="bg-background/90 border-border/60 sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b px-3 backdrop-blur sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
              <Breadcrumb className="min-w-0">
                <BreadcrumbList className="flex-nowrap">
                  {!isDashboard ? (
                    <>
                      <BreadcrumbItem className="hidden sm:inline-flex">
                        <BreadcrumbLink asChild>
                          <Link href="/dashboard">Dashboard</Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden sm:block" />
                      {isProjectSettings && breadcrumbProject ? (
                        <>
                          <BreadcrumbItem className="hidden min-w-0 sm:inline-flex">
                            <BreadcrumbLink asChild>
                              <Link
                                href={`/wiki/${breadcrumbProject.id}`}
                                className="max-w-48 truncate"
                              >
                                {breadcrumbProject.name}
                              </Link>
                            </BreadcrumbLink>
                          </BreadcrumbItem>
                          <BreadcrumbSeparator className="hidden sm:block" />
                        </>
                      ) : null}
                    </>
                  ) : null}
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate">
                      {pageTitle}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <NotificationCenter />
              <AccountMenu />
            </div>
          </header>
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
