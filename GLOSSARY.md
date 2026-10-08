# Workspace

Product concepts for managing projects that already exist as folders. Workspace names both the application and an individual working configuration; use the surrounding context to distinguish them.

## Language

**Workspace (working configuration)**:
A saved configuration with its own project source, folder roles, and views. Workspaces may share a source or use independent sources.

**Project source**:
The selected root folder within which a Workspace discovers projects. Multiple Workspaces may use the same source.

**Project**:
A folder identified as a project through its assigned role, together with its properties. It is the user's unit of work, distinct from an application development issue.

**View**:
A saved presentation of a Workspace's projects, such as Board or Table, with its own display and filtering settings.

**Property**:
A project field, such as Name, Status, or a custom field. A property value belongs to an individual project.

**Folder role**:
A folder's discovery purpose: group is a container, status supplies a project status, and project identifies the project itself.

**Status**:
A project's state derived from its enclosing status-role folder. A project outside such a folder has No status.
