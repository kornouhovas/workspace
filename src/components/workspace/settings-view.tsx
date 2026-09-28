import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkspacePropertyControls } from "@/components/workspace/property-controls";
import { useI18n } from "@/i18n";
import { ChevronDownIcon, ChevronRightIcon } from "@/lib/workspace-icons";
import type {
  WorkspaceFolderRoleNode,
  WorkspaceProjectionResponse,
  WorkspaceSelectValueState,
} from "@/workspaceAppState";

type WorkspaceSourceFolder = {
  readonly name: string;
  readonly path: string;
  readonly state: string;
};

type WorkspaceSettingsViewProps = {
  readonly theme?: "light" | "dark" | "system";
  readonly onThemeChange?: (theme: "light" | "dark" | "system") => void;
  readonly sourceFolder: WorkspaceSourceFolder;
  readonly folderRoleTree: readonly WorkspaceFolderRoleNode[];
  readonly statusValues: WorkspaceProjectionResponse["statusValues"];
  readonly selectValues: readonly WorkspaceSelectValueState[];
  readonly onSelectFolder: () => void;
  readonly onFolderRoleChange: (
    node: WorkspaceFolderRoleNode,
    role: WorkspaceFolderRoleNode["role"],
  ) => void;
  readonly onColorStatusValue: (statusValueId: string, color: string) => void;
  readonly selectingFolder?: boolean;
};

const roleOptions = ["group", "status", "project"] as const;
const folderStateTranslationKeys: Readonly<Record<string, string>> = {
  Ready: "settings.folderState.ready",
  Group: "settings.folderState.group",
  "Contains folders": "settings.folderState.containsFolders",
  Discovered: "settings.folderState.discovered",
};

function FolderRoleNode({
  node,
  depth = 0,
  expandedFolderIds,
  onToggleFolderExpanded,
  onFolderRoleChange,
}: {
  readonly node: WorkspaceFolderRoleNode;
  readonly depth?: number;
  readonly expandedFolderIds: ReadonlySet<string>;
  readonly onToggleFolderExpanded: (nodeId: string) => void;
  readonly onFolderRoleChange: (
    node: WorkspaceFolderRoleNode,
    role: WorkspaceFolderRoleNode["role"],
  ) => void;
}) {
  const { t } = useI18n();
  const hasChildren = node.children.length > 0;
  const expanded = expandedFolderIds.has(node.id);
  const statusLabel = folderStateTranslationKeys[node.status]
    ? t(folderStateTranslationKeys[node.status])
    : node.status;

  return (
    <li>
      <div
        className="workspace-folder-role-row grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
        style={{ marginLeft: `${Math.min(depth, 4) * 0.5}rem` }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={!hasChildren}
          aria-label={
            expanded
              ? t("settings.collapseFolder", { name: node.name })
              : t("settings.expandFolder", { name: node.name })
          }
          onClick={() => onToggleFolderExpanded(node.id)}
        >
          {expanded ? (
            <ChevronDownIcon className="size-4" aria-hidden="true" />
          ) : (
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          )}
        </Button>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 break-words text-sm font-medium" title={node.name}>{node.name}</span>
            <Badge variant="outline">{statusLabel}</Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground" title={node.relativePath}>
            {node.relativePath}
          </p>
        </div>
        <ToggleGroup
          className="col-start-2 flex-wrap justify-start"
          aria-label={t("settings.roleFor", { name: node.name })}
          value={node.role}
          onValueChange={(value) => {
            if (value === "group" || value === "status" || value === "project") {
              onFolderRoleChange(node, value);
            }
          }}
          size="sm"
          type="single"
          variant="outline"
        >
          {roleOptions.map((role) => (
            <ToggleGroupItem
              key={role}
              aria-label={t("settings.setRole", {
                name: node.name,
                role: t(`settings.role.${role}`),
              })}
              value={role}
            >
              {t(`settings.role.${role}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {hasChildren && expanded ? (
        <ul className="mt-1.5 grid gap-1.5">
          {node.children.map((child) => (
            <FolderRoleNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedFolderIds={expandedFolderIds}
              onToggleFolderExpanded={onToggleFolderExpanded}
              onFolderRoleChange={onFolderRoleChange}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WorkspaceSettingsView({
  theme = "system",
  onThemeChange,
  sourceFolder,
  folderRoleTree,
  statusValues,
  selectValues,
  onSelectFolder,
  onFolderRoleChange,
  onColorStatusValue,
  selectingFolder = false,
}: WorkspaceSettingsViewProps) {
  const { locale, setLocale, t } = useI18n();
  const [expandedFolderIds, setExpandedFolderIds] = useState<ReadonlySet<string>>(() => new Set());

  function toggleFolderExpanded(nodeId: string) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  }

  return (
    <section
      className="workspace-settings grid min-w-0 gap-2 px-3 py-3"
      aria-label={t("settings.title")}
    >
      <div className="grid content-start gap-2">
        {onThemeChange && (
          <section
            className="rounded-md border border-border bg-card"
            aria-labelledby="workspace-appearance-heading"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <h3 id="workspace-appearance-heading" className="text-sm font-semibold">
                {t("chrome.appearance")}
              </h3>
              <Select
                value={theme}
                onValueChange={(value) => {
                  if (value === "light" || value === "dark" || value === "system")
                    onThemeChange(value);
                }}
              >
                <SelectTrigger className="w-28" aria-label={t("chrome.appearance")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="light">{t("chrome.light")}</SelectItem>
                    <SelectItem value="dark">{t("chrome.dark")}</SelectItem>
                    <SelectItem value="system">{t("chrome.systemTheme")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </section>
        )}
        <div className="rounded-md border border-border bg-card">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <h3 className="text-sm font-semibold">{t("settings.source")}</h3>
            <Badge variant="secondary">{t("settings.localOnly")}</Badge>
          </div>
          <Separator />
          <div className="grid gap-2 p-3">
            <div className="grid gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t("settings.sourceFolder")}
              </p>
              <p className="truncate text-sm font-medium" title={sourceFolder.name}>
                {sourceFolder.name}
              </p>
              <p className="break-all text-xs text-muted-foreground">{sourceFolder.path}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              disabled={selectingFolder}
              onClick={onSelectFolder}
            >
              {selectingFolder ? t("settings.selectingFolder") : t("settings.selectFolder")}
            </Button>
          </div>
        </div>
        <section
          className="rounded-md border border-border bg-card"
          aria-labelledby="workspace-language-heading"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <h3 id="workspace-language-heading" className="text-sm font-semibold">
                {t("language.title")}
              </h3>
              <p className="truncate text-xs text-muted-foreground">{t("language.description")}</p>
            </div>
            <Select
              value={locale}
              onValueChange={(nextLocale) => {
                if (nextLocale === "en" || nextLocale === "ru") {
                  setLocale(nextLocale);
                }
              }}
            >
              <SelectTrigger size="sm" className="shrink-0" aria-label={t("language.interface")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="en">{t("language.english")}</SelectItem>
                  <SelectItem value="ru">{t("language.russian")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </section>
      </div>
      <div className="min-w-0 rounded-md border border-border bg-card">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{t("settings.folderRoleTree")}</h3>
            <p className="truncate text-xs text-muted-foreground" title={sourceFolder.path}>
              {sourceFolder.path}
            </p>
          </div>
          <Badge variant="outline">{t("settings.roots", { count: folderRoleTree.length })}</Badge>
        </div>
        <Separator />
        <ul className="grid max-h-80 gap-1.5 overflow-auto p-3">
          {folderRoleTree.map((node) => (
            <FolderRoleNode
              key={node.id}
              node={node}
              expandedFolderIds={expandedFolderIds}
              onToggleFolderExpanded={toggleFolderExpanded}
              onFolderRoleChange={onFolderRoleChange}
            />
          ))}
        </ul>
      </div>
      <div className="col-span-full min-w-0">
        <WorkspacePropertyControls
          statusValues={statusValues}
          selectValues={selectValues}
          onColorStatusValue={onColorStatusValue}
        />
      </div>
    </section>
  );
}
