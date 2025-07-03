
"use client"

import { Sidebar, SidebarHeader } from "~/components/ui/sidebar"

export  function AppSideBar(){
   return(
      <Sidebar collapsible="icon" variant="floating">
         <SidebarHeader>
            Logo
         </SidebarHeader>
      </Sidebar>
   )
}