export type WorkspaceMockStatusValue = {
  readonly id: string;
  readonly name: string;
  readonly relativePath: string | null;
  readonly source: string;
};

export type WorkspaceMockVisibleProperty = {
  readonly id: string;
  readonly name: string;
  readonly propertyType: string;
  readonly system: boolean;
};

export type WorkspaceMockFileTreeNode = {
  readonly id: string;
  readonly name: string;
  readonly kind: "file" | "folder";
  readonly relativePath: string;
  readonly available: boolean;
  readonly children?: readonly WorkspaceMockFileTreeNode[];
};

export type WorkspaceMockProject = {
  readonly id: string;
  readonly name: string;
  readonly currentRelativePath: string;
  readonly status: WorkspaceMockStatusValue;
  readonly propertyValues: Record<string, string>;
  readonly fileTree: readonly WorkspaceMockFileTreeNode[];
};

export type WorkspaceMockFolderRoleNode = {
  readonly id: string;
  readonly name: string;
  readonly relativePath: string;
  readonly role: "group" | "status" | "project";
  readonly status: string;
  readonly children: readonly WorkspaceMockFolderRoleNode[];
};

const activeStatus = {
  id: "statusValue:active",
  name: "Active",
  relativePath: "Active",
  source: "folderRole",
} as const;

const reviewStatus = {
  id: "statusValue:review",
  name: "Review",
  relativePath: "Review",
  source: "folderRole",
} as const;

const noStatus = {
  id: "statusValue:no-status",
  name: "No status",
  relativePath: null,
  source: "no-status",
} as const;

const projects: readonly WorkspaceMockProject[] = [
  {
    id: "project:alpha",
    name: "Project Alpha",
    currentRelativePath: "Active/Project Alpha",
    status: activeStatus,
    propertyValues: {
      "property:name": "Project Alpha",
      "property:status": activeStatus.id,
      "property:priority": "High",
      "property:owner": "Design Ops",
    },
    fileTree: [
      {
        id: "file:alpha-brief",
        name: "brief.md",
        kind: "file",
        relativePath: "Active/Project Alpha/brief.md",
        available: true,
      },
      {
        id: "folder:alpha-assets",
        name: "assets",
        kind: "folder",
        relativePath: "Active/Project Alpha/assets",
        available: true,
        children: [
          {
            id: "file:alpha-logo",
            name: "logo.png",
            kind: "file",
            relativePath: "Active/Project Alpha/assets/logo.png",
            available: true,
          },
          {
            id: "file:alpha-missing-comp",
            name: "old-comp.sketch",
            kind: "file",
            relativePath: "Active/Project Alpha/assets/old-comp.sketch",
            available: false,
          },
        ],
      },
      {
        id: "folder:alpha-notes",
        name: "notes",
        kind: "folder",
        relativePath: "Active/Project Alpha/notes",
        available: true,
        children: [
          {
            id: "file:alpha-retro",
            name: "retro.txt",
            kind: "file",
            relativePath: "Active/Project Alpha/notes/retro.txt",
            available: true,
          },
        ],
      },
    ],
  },
  {
    id: "project:beta",
    name: "Project Beta",
    currentRelativePath: "Review/Project Beta",
    status: reviewStatus,
    propertyValues: {
      "property:name": "Project Beta",
      "property:status": reviewStatus.id,
      "property:priority": "Medium",
      "property:owner": "Platform",
    },
    fileTree: [
      {
        id: "file:beta-readme",
        name: "README.md",
        kind: "file",
        relativePath: "Review/Project Beta/README.md",
        available: true,
      },
      {
        id: "folder:beta-docs",
        name: "docs",
        kind: "folder",
        relativePath: "Review/Project Beta/docs",
        available: true,
        children: [
          {
            id: "file:beta-plan",
            name: "release-plan.md",
            kind: "file",
            relativePath: "Review/Project Beta/docs/release-plan.md",
            available: true,
          },
        ],
      },
    ],
  },
  {
    id: "project:gamma",
    name: "Project Gamma",
    currentRelativePath: "Project Gamma",
    status: noStatus,
    propertyValues: {
      "property:name": "Project Gamma",
      "property:status": noStatus.id,
      "property:priority": "Low",
      "property:owner": "Research",
    },
    fileTree: [
      {
        id: "file:gamma-notes",
        name: "notes.md",
        kind: "file",
        relativePath: "Project Gamma/notes.md",
        available: true,
      },
    ],
  },
] as const;

export const workspaceMockSettings: {
  readonly sourceFolder: {
    readonly name: string;
    readonly path: string;
    readonly state: string;
  };
  readonly folderRoleTree: readonly WorkspaceMockFolderRoleNode[];
} = {
  sourceFolder: {
    name: "Client Work",
    path: "/Users/aleksandersk/Projects/Client Work",
    state: "placeholder",
  },
  folderRoleTree: [
    {
      id: "folder:active",
      name: "Active",
      relativePath: "Active",
      role: "status",
      status: "Ready",
      children: [
        {
          id: "folder:active-alpha",
          name: "Project Alpha",
          relativePath: "Active/Project Alpha",
          role: "project",
          status: "Discovered",
          children: [
            {
              id: "folder:active-alpha-assets",
              name: "assets",
              relativePath: "Active/Project Alpha/assets",
              role: "group",
              status: "Nested",
              children: [],
            },
          ],
        },
      ],
    },
    {
      id: "folder:review",
      name: "Review",
      relativePath: "Review",
      role: "status",
      status: "Ready",
      children: [
        {
          id: "folder:review-beta",
          name: "Project Beta",
          relativePath: "Review/Project Beta",
          role: "project",
          status: "Discovered",
          children: [],
        },
      ],
    },
    {
      id: "folder:archive",
      name: "Archive",
      relativePath: "Archive",
      role: "group",
      status: "Ignored",
      children: [],
    },
  ],
} as const;

export const workspaceMockProjection = {
  workspaceId: "workspace:ops",
  activeViewId: "view:board",
  views: [
    { id: "view:board", name: "Board", viewType: "board" },
    { id: "view:table", name: "Table", viewType: "table" },
  ],
  view: { id: "view:board", name: "Board", viewType: "board" },
  tableView: { id: "view:table", name: "Table", viewType: "table" },
  visibleProperties: [
    { id: "property:name", name: "Name", propertyType: "text", system: true },
    { id: "property:status", name: "Status", propertyType: "status", system: true },
    { id: "property:priority", name: "Priority", propertyType: "select", system: false },
    { id: "property:owner", name: "Owner", propertyType: "text", system: false },
  ],
  statusValues: [activeStatus, reviewStatus, noStatus],
  projection: {
    type: "board",
    capabilities: { canMoveBetweenStatuses: false },
    columns: [
      {
        statusValueId: activeStatus.id,
        name: activeStatus.name,
        projects: [projects[0]],
      },
      {
        statusValueId: reviewStatus.id,
        name: reviewStatus.name,
        projects: [projects[1]],
      },
      {
        statusValueId: noStatus.id,
        name: noStatus.name,
        projects: [projects[2]],
      },
    ],
  },
  tableProjection: {
    type: "table",
    rows: projects,
  },
  selectedProject: projects[0],
} as const;

export type WorkspaceMockProjection = typeof workspaceMockProjection;
