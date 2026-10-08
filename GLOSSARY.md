# Workspace

Workspace helps people organize real project folders using properties and saved views.

## Language

**Workspace**:
A saved working configuration for a selected project source. Multiple workspaces can use the same source.
_Avoid_: Root folder, project

**Project source**:
A selected root folder that bounds the projects a workspace can discover and operate on.
_Avoid_: Workspace, database

**Project**:
A real folder managed through its associated properties and views.
_Avoid_: Issue, task

**Property**:
A named project field, such as a date, number or selection. A property's definition is distinct from the value assigned to a particular project.

**View**:
A saved presentation of projects, including its layout, filtering and grouping choices.
_Avoid_: Workspace

**Private view**:
A view intended for its owner's use.

**Shared view**:
A view available to the participants of a shared project source.
_Avoid_: Public link, public website

**Folder-backed Select**:
A selection property whose values correspond to project-containing folders. Its display name can differ from the folder names.
_Avoid_: Status when the property represents another category

**Archived project**:
A project moved to the source's designated archive folder while retaining its properties and the ability to restore it.
_Avoid_: Deleted project, Select option
