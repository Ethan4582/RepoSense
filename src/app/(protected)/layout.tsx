import * as React from "react";
import { SidebarProvider } from "~/components/ui/sidebar";
import { AppSideBar } from "../app-sidebar";

type Props = {
  children: React.ReactNode;
};

export default function SideBarLayout({ children }: Props) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSideBar />
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
