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

**Project preview**:
A temporary presentation of a project's properties and file tree alongside the current work area.
_Avoid_: File preview

**Project tab**:
A retained open presentation of a project within a workspace.
_Avoid_: View, project record

**Project area**:
The working area that displays one project's properties and file tree, either beside the current view or expanded into the work area.
_Avoid_: Split tree, file viewer

**Workspace session**:
The open content and arrangement of working areas used to resume work in a workspace on a particular device.
_Avoid_: Saved view, project source

**Folder-backed Select**:
A selection property whose values correspond to project-containing folders. Its display name can differ from the folder names.
_Avoid_: Status when the property represents another category

**Archived project**:
A project moved to the source's designated archive folder while retaining its properties and the ability to restore it.
_Avoid_: Deleted project, Select option

**Project chat**:
A personal conversation with an agent in the context of a particular project. A project can have multiple chats.

**Agent run**:
An execution of an agent task within a project chat. Multiple runs can work on the same project concurrently.

**Host**:
The owner's computer that provides access to its workspaces from the owner's other devices.
