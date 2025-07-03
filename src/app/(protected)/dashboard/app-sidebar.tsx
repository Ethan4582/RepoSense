"use client"

import { Bot, CreditCard, LayoutDashboard, Plus, Presentation } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "~/components/ui/button"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "~/components/ui/sidebar"
import { cn } from "~/lib/utils" 

const items = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    url: "/dashboard"
  },
  {
    title: "Q&A",
    icon: Bot,
    url: "/qa"
  },
  {
    title: "Meeting",
    icon: Presentation,
    url: "/meetings"
  },
  {
    title: "Billing",
    icon: CreditCard,
    url: "/billing"
  }
]

const projects = [
  {
    name: "Project 1",
    url: "/projects/1"
  },
  {
    name: "Project 2",
    url: "/projects/2"
  }
]

export function AppSideBar() {
  const pathname = usePathname()
  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <div className="flex items-center gap-2">
         {/* <Image src="/logo.png" alt="Logo" width={40} height={40} alt=;logo" /> */}
          
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            Application
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
                {items.map(item => {
              const Icon = item.icon
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url}
                      className={cn(
                        pathname === item.url && '!bg-primary !text-white'
                      )}
                    >
                      <Icon className="mr-2" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
         <SidebarGroup>
            <SidebarGroupLabel>
               Your Projects
               </SidebarGroupLabel>
               <SidebarContent>
                   <SidebarMenu>
                      {projects.map(project =>{
                        return(
                           <SidebarMenuItem key={project.name}>
                              <SidebarMenuButton asChild>
                                 <div>
                                    <div className={cn(
                                       'rounded-sm border size-6 flex items-center justify-center text-sm bg-white text-primary',{
                                          // 'bg-primary text-white'=== project.name==project.id 
                                           'bg-primary text-white':true
                                       }
                                    )}>
                                       {project.name[0].toUpperCase()}

                                    </div>

                                    <span className="ml-2 text-sm">
                                       {project.name}
                                    </span>
                                 </div>
                              </SidebarMenuButton>
                           </SidebarMenuItem>
                        )
                      })}
                      <div className="mt-2">
                     <SidebarMenuItem>
                     <Link href="/create">
                     <Button size="sm" variant="outline" className="w-fit">
                        <Plus className="mr-2" />
                        Create Project
                       </Button>
                     
                     </Link>
                        </SidebarMenuItem>
                      </div>
                     </SidebarMenu>
                  </SidebarContent>
          </SidebarGroup>


      </SidebarContent>
    </Sidebar>
   )
}