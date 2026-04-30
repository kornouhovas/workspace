import test from "node:test";
import assert from "node:assert/strict";
import {
  createFolderObjectId,
  createPropertyValueId,
  projectFoldersToWorkspaceObjects,
  readSystemPropertyValue,
} from "../src/workspaceObjects.js";

test("createFolderObjectId creates stable workspace-scoped slugs from folder paths", () => {
  assert.equal(
    createFolderObjectId("workspace:main", "Active/Project Alpha"),
    "object:workspace-main:active-project-alpha",
  );
  assert.equal(
    createFolderObjectId("workspace:main", "  Roadmap 2026 / Q2 Review! "),
    "object:workspace-main:roadmap-2026-q2-review",
  );
});

test("createPropertyValueId combines object and property identifiers", () => {
  assert.equal(
    createPropertyValueId("object:workspace-main:active-project-alpha", "property:text"),
    "value:object:workspace-main:active-project-alpha:property:text",
  );
});

test("projectFoldersToWorkspaceObjects maps folders to workspace objects and text property values", () => {
  const projection = projectFoldersToWorkspaceObjects({
    workspaceId: "workspace:main",
    rootPath: "/Users/example/Workspace",
    folders: [
      {
        name: "Project Alpha",
        status: "Active",
        path: "Active/Project Alpha",
        text: " Project context ",
      },
      {
        name: "Completed",
        status: "Archive",
        path: "Archive/Completed",
        text: "   ",
      },
    ],
  });

  assert.deepEqual(projection.objects, [
    {
      id: "object:workspace-main:active-project-alpha",
      workspaceId: "workspace:main",
      type: "project",
      source: {
        kind: "folder",
        path: "Active/Project Alpha",
        absoluteRoot: "/Users/example/Workspace",
      },
      folderName: "Project Alpha",
      folderStatus: "Active",
    },
    {
      id: "object:workspace-main:archive-completed",
      workspaceId: "workspace:main",
      type: "project",
      source: {
        kind: "folder",
        path: "Archive/Completed",
        absoluteRoot: "/Users/example/Workspace",
      },
      folderName: "Completed",
      folderStatus: "Archive",
    },
  ]);
  assert.deepEqual(projection.propertyValues, [
    {
      id: "value:object:workspace-main:active-project-alpha:property:text",
      workspaceId: "workspace:main",
      objectId: "object:workspace-main:active-project-alpha",
      propertyId: "property:text",
      type: "text",
      value: " Project context ",
    },
  ]);
});

test("readSystemPropertyValue returns derived system values", () => {
  const object = {
    folderName: "Project Alpha",
    folderStatus: "Active",
  };

  assert.equal(readSystemPropertyValue(object, "property:name"), "Project Alpha");
  assert.equal(readSystemPropertyValue(object, "property:status"), "Active");
  assert.equal(readSystemPropertyValue(object, "property:text"), undefined);
});
