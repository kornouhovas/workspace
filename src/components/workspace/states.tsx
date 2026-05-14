export function WorkspaceEmptyState() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center">
      <div>
        <h2 className="text-lg font-semibold">No source folder selected</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Select a project source folder in Settings to load Workspaces, Board, and Table views.
        </p>
      </div>
      <button
        type="button"
        className="inline-flex h-8 items-center rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
      >
        Open Settings
      </button>
    </div>
  );
}
