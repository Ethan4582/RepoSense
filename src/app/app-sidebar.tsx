"use client"

import { Bot, CreditCard, LayoutDashboard, PanelRightClose, Plus, Presentation, X } from "lucide-react"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "~/components/ui/button"
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "~/components/ui/sidebar"
import useProject from "~/hooks/use-project"
import { cn } from "~/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

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
    title: "Meetings",
    icon: Bot,
    url: "/meetings"
  },
  {
    title: "Billing",
    icon: CreditCard,
    url: "/billing"
  }
]

export function AppSideBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { open, setOpen } = useSidebar()
  const { projects, projectId, setProjectId } = useProject()

  return (
    <motion.div
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -40, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-full"
    >
      <Sidebar collapsible="icon" variant="floating">
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={40} height={40} />
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2"
                >
                  <h1 className="text-xl font-semibold text-primary">
                    Reposense
                  </h1>
                  <button
                    type="button"
                    className="ml-2 p-1 rounded hover:bg-gray-100 transition"
                    onClick={() => setOpen(false)}
                    aria-label="Close sidebar"
                  >
                     <PanelRightClose className="w-5 mt-1 h-6 text-primary" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>
              {/* Application */}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map(item => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => router.push(item.url)}
                        className={cn(
                          pathname === item.url && '!bg-primary !text-white'
                        )}
                      >
                        <Icon className="mr-2" />
                        <span>{item.title}</span>
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
                      {projects?.map(project =>{
                        return(
                           <SidebarMenuItem key={project.name}>
                              <SidebarMenuButton asChild>
                                 <div onClick={()=>{
                                  setProjectId(project.id)
                                 }}>
                                    <div className={cn(
                                       'rounded-sm border size-6 flex items-center justify-center text-sm bg-white text-primary',{
                                          'bg-primary text-white': project.id===projectId

                                       }
                                    )}>
                                      {/* i made a change */}
                                       {project.name[0]!.toUpperCase()}

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
                      {open &&
                       <SidebarMenuItem>
                     <Link href="/create">
                     <Button size="sm" variant="outline" className="w-fit">
                        <Plus className="mr-2" />
                        Create Project
                       </Button>
                     
                     </Link>
                        </SidebarMenuItem>
                         }
                      
                      </div>
                     </SidebarMenu>
                  </SidebarContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </motion.div>
  )
}