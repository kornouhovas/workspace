import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileIcon, FolderIcon, XIcon } from "@/lib/lucide-icons";
import type {
  WorkspaceMockFileTreeNode,
  WorkspaceMockProject,
  WorkspaceMockVisibleProperty,
} from "@/workspaceMockData";

type WorkspaceProjectDetailPanelProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly project: WorkspaceMockProject | null;
  readonly visibleProperties: readonly WorkspaceMockVisibleProperty[];
};

const projectDetailPanelWidthStorageKey = "workspace.projectDetailPanelWidth";
const defaultProjectDetailPanelWidth = 480;
const minProjectDetailPanelWidth = 360;
const maxProjectDetailPanelWidth = 760;

function getMaxProjectDetailPanelWidth() {
  if (typeof window === "undefined") {
    return maxProjectDetailPanelWidth;
  }

  return Math.min(
    maxProjectDetailPanelWidth,
    Math.max(minProjectDetailPanelWidth, window.innerWidth - 96),
  );
}

function clampProjectDetailPanelWidth(value: number) {
  const fallbackWidth = Number.isFinite(value) ? value : defaultProjectDetailPanelWidth;
  return Math.min(
    getMaxProjectDetailPanelWidth(),
    Math.max(minProjectDetailPanelWidth, Math.round(fallbackWidth)),
  );
}

function readSavedProjectDetailPanelWidth() {
  if (typeof window === "undefined") {
    return defaultProjectDetailPanelWidth;
  }

  return clampProjectDetailPanelWidth(Number(window.localStorage.getItem(projectDetailPanelWidthStorageKey)));
}

function getPropertyValue(project: WorkspaceMockProject, property: WorkspaceMockVisibleProperty) {
  if (property.id === "property:name") {
    return project.name;
  }

  if (property.id === "property:status") {
    return project.status.name;
  }

  return project.propertyValues[property.id as keyof typeof project.propertyValues] ?? "";
}

function FileTreeNode({ node, depth = 0 }: { readonly node: WorkspaceMockFileTreeNode; readonly depth?: number }) {
  const isFolder = node.kind === "folder";

  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        disabled={!node.available}
        className="h-auto w-full justify-start px-2 py-1.5 text-left"
        title={node.relativePath}
      >
        <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2" style={{ paddingLeft: `${depth * 1}rem` }}>
          {isFolder ? (
            <FolderIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <FileIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm">{node.name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{node.relativePath}</span>
          </span>
          {!node.available ? <Badge variant="destructive">Missing</Badge> : null}
        </span>
      </Button>
      {isFolder && node.children && node.children.length > 0 ? (
        <ul className="grid gap-1">
          {node.children.map((child) => (
            <FileTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WorkspaceProjectDetailPanel({
  open,
  onOpenChange,
  project,
  visibleProperties,
}: WorkspaceProjectDetailPanelProps) {
  const [projectDetailPanelWidth, setProjectDetailPanelWidth] = useState(readSavedProjectDetailPanelWidth);
  const panelWidthRef = useRef(projectDetailPanelWidth);
  const isOpen = open && project !== null;

  useEffect(() => {
    panelWidthRef.current = projectDetailPanelWidth;
  }, [projectDetailPanelWidth]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(projectDetailPanelWidthStorageKey, String(projectDetailPanelWidth));
  }, [isOpen, projectDetailPanelWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function handleResize() {
      setProjectDetailPanelWidth((currentWidth) => clampProjectDetailPanelWidth(currentWidth));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  function updatePanelWidth(nextWidth: number) {
    const clampedWidth = clampProjectDetailPanelWidth(nextWidth);
    panelWidthRef.current = clampedWidth;
    setProjectDetailPanelWidth(clampedWidth);
  }

  function startPanelResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidthRef.current;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    function handlePointerMove(pointerEvent: PointerEvent) {
      updatePanelWidth(startWidth + startX - pointerEvent.clientX);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.localStorage.setItem(projectDetailPanelWidthStorageKey, String(panelWidthRef.current));
    }

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex justify-end",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Close project details backdrop"
        className="absolute inset-0 cursor-default bg-transparent"
        tabIndex={isOpen ? 0 : -1}
        onClick={() => onOpenChange(false)}
      />
      <aside
        aria-labelledby="project-detail-title"
        aria-modal="false"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
        className={[
          "pointer-events-auto relative flex h-full max-w-[calc(100vw-6rem)] flex-col gap-4 border-l border-border bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        style={{ width: projectDetailPanelWidth }}
      >
        <button
          type="button"
          aria-label="Resize project panel"
          className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize border-l border-transparent hover:border-ring focus-visible:border-ring focus-visible:outline-none"
          onPointerDown={startPanelResize}
        >
          <span className="sr-only">Resize project panel</span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-3 top-3 z-10"
          aria-label="Close project details"
          onClick={() => onOpenChange(false)}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </Button>
        {project ? (
          <>
            <header className="grid gap-0.5 p-4 pr-12">
              <h2 id="project-detail-title" className="font-heading text-base font-medium text-foreground">
                {project.name}
              </h2>
              <p className="truncate text-sm text-muted-foreground">{project.currentRelativePath}</p>
            </header>
            <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
              <div className="grid gap-4">
                <section className="grid gap-2" aria-labelledby="project-identity-heading">
                  <h3 id="project-identity-heading" className="text-xs font-medium text-muted-foreground">
                    Name
                  </h3>
                  <div className="grid gap-1">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{project.status.name}</Badge>
                      <span className="truncate text-xs text-muted-foreground">{project.currentRelativePath}</span>
                    </div>
                  </div>
                </section>
                <Separator />
                <section className="grid gap-2" aria-labelledby="project-properties-heading">
                  <h3 id="project-properties-heading" className="text-xs font-medium text-muted-foreground">
                    Properties
                  </h3>
                  <dl className="grid gap-2">
                    {visibleProperties.map((property) => (
                      <div key={property.id} className="grid grid-cols-[6rem_1fr] gap-3 text-sm">
                        <dt className="truncate text-muted-foreground">{property.name}</dt>
                        <dd className="truncate text-foreground">{getPropertyValue(project, property)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <Separator />
                <section className="grid gap-2" aria-labelledby="project-file-tree-heading">
                  <div className="flex items-center justify-between gap-3">
                    <h3 id="project-file-tree-heading" className="text-xs font-medium text-muted-foreground">
                      File tree
                    </h3>
                    <Badge variant="secondary">{project.fileTree.length} items</Badge>
                  </div>
                  <ul className="grid gap-1">
                    {project.fileTree.map((node) => (
                      <FileTreeNode key={node.id} node={node} />
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </>
        ) : (
          <header className="grid gap-0.5 p-4 pr-12">
            <h2 id="project-detail-title" className="font-heading text-base font-medium text-foreground">
              Project detail
            </h2>
            <p className="text-sm text-muted-foreground">No project selected.</p>
          </header>
        )}
      </aside>
    </div>
  );
}
