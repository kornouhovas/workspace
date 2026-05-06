import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {
  return (
    <header className="electron-window-drag flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="site-header-content flex h-full w-full items-center gap-1 lg:gap-2">
        <SidebarTrigger
          size="icon-xs"
          className="electron-window-no-drag"
        />
        <Separator
          orientation="vertical"
          className="mx-1.5 data-[orientation=vertical]:h-3"
        />
        <h1 className="text-sm font-medium leading-none">Documents</h1>
      </div>
    </header>
  )
}
