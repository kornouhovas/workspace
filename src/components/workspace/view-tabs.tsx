import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontalIcon, PlusIcon } from "@/lib/lucide-icons";

type WorkspaceView = {
  readonly id: string;
  readonly name: string;
  readonly viewType: string;
};

type WorkspaceViewTabsProps = {
  readonly activeViewId: string;
  readonly views: readonly WorkspaceView[];
};

export function WorkspaceViewTabs({ activeViewId, views }: WorkspaceViewTabsProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
      <Tabs value={activeViewId} className="min-w-0">
        <TabsList variant="line" aria-label="Workspace views">
          {views.map((view) => (
            <TabsTrigger key={view.id} value={view.id} className="capitalize">
              {view.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Add Board or Table view"
          title="Add view"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="View actions"
          title="View actions"
        >
          <MoreHorizontalIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
