import { UserButton } from "@clerk/nextjs"
import { SidebarProvider } from "~/components/ui/sidebar"
import { AppSideBar } from "../app-sidebar"


type Props ={
 children: React.ReactNode // it what every that render inside the main page 
}

export default function SideBarLayout({children}: Props) {
   return(
      <SidebarProvider>
         < AppSideBar/>
         <main className="w-full m-2">
            <div className="flex items-center gap-2 border-sidebar-border bg-sidebar border shadow rounded-md px-2 py-2">
               <span className="text-lg font-semibold text-blue-500">
                 🚀 Welcome to Reposense — Search, Summarize, and Collaborate on Your Code!
               </span>
               <div className="ml-auto"></div>
               <UserButton/>
            </div>
            <div className="h-4"></div>
            {/* mian contednt */}

            <div className="border-sidebar-border  bg-sidebar border shadow rounded-md overflow-auto overflow-y-scroll h-[calc(102.5vh-6rem)] p-4">
               {children}
            </div>
         </main>
      </SidebarProvider>
   )
}