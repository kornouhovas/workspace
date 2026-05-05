import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import data from "./app/dashboard/data.json";

export default function App() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="dashboard-01-shell dark flex min-h-screen w-full">
          <AppSidebar variant="inset" />
          <SidebarInset>
            <SiteHeader />
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
              <SectionCards />
              <ChartAreaInteractive />
              <DataTable data={data} />
            </main>
          </SidebarInset>
          <Toaster />
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
