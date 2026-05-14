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

const projects = [
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
  },
] as const;

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
} as const;

export type WorkspaceMockProjection = typeof workspaceMockProjection;
export type WorkspaceMockVisibleProperty = WorkspaceMockProjection["visibleProperties"][number];
export type WorkspaceMockProject = (typeof projects)[number];
