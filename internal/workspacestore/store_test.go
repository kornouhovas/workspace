package workspacestore

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

func TestStorePersistsWorkspaceRootAndPropertyValue(t *testing.T) {
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), "workspace.db")

	store, err := Open(ctx, dbPath)
	if err != nil {
		t.Fatal(err)
	}

	root, err := store.GetRoot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if root != (RootDocument{}) {
		t.Fatalf("expected missing root to return zero value, got %#v", root)
	}

	if err := store.SetRoot(ctx, RootDocument{
		ID:       "workspace:root",
		RootPath: "/tmp/workspace-root",
		Name:     "workspace-root",
	}); err != nil {
		t.Fatal(err)
	}

	value := PropertyValueDocument{
		ID:          "value:object-1:property:text",
		WorkspaceID: "workspace:root",
		ObjectID:    "object-1",
		PropertyID:  "property:text",
		Type:        "text",
		Value:       "note",
	}
	if err := store.UpsertPropertyValue(ctx, value); err != nil {
		t.Fatal(err)
	}

	if err := store.Close(); err != nil {
		t.Fatal(err)
	}

	reopened, err := Open(ctx, dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()

	root, err = reopened.GetRoot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if root.ID != "workspace:root" || root.RootPath != "/tmp/workspace-root" || root.Name != "workspace-root" {
		t.Fatalf("expected root to persist, got %#v", root)
	}

	values, err := reopened.ListPropertyValues(ctx, "workspace:root")
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 {
		t.Fatalf("expected one property value, got %#v", values)
	}
	if values[0].WorkspaceID != "workspace:root" || values[0].Value != "note" {
		t.Fatalf("expected saved text value, got %#v", values[0])
	}
}

func TestSetRootStoresRootAtFixedDocumentID(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	if err := store.SetRoot(ctx, RootDocument{
		ID:       "workspace:other",
		RootPath: "/tmp/workspace-root",
		Name:     "workspace-root",
	}); err != nil {
		t.Fatal(err)
	}

	root, err := store.GetRoot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if root.ID != "workspace:root" {
		t.Fatalf("expected default root id, got %q", root.ID)
	}
	if root.RootPath != "/tmp/workspace-root" {
		t.Fatalf("expected root path to persist, got %q", root.RootPath)
	}
}

func TestStorePersistsWorkspaceViewsWithoutBreakingRootDocument(t *testing.T) {
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), "workspace.db")

	store, err := Open(ctx, dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	if err := store.SetRoot(ctx, RootDocument{
		ID:       "workspace:other",
		RootPath: "/tmp/workspace-root",
		Name:     "workspace-root",
	}); err != nil {
		t.Fatal(err)
	}

	workspace := WorkspaceDocument{
		ID:             "workspace:ops",
		Type:           "workspace",
		SchemaVersion:  1,
		SourceFolderID: "projectSource:default",
		Name:           "Operations",
		Order:          10,
		ActiveViewID:   "view:board",
		CreatedAt:      "2026-05-14T00:00:00.000Z",
		UpdatedAt:      "2026-05-14T00:00:00.000Z",
	}
	if err := store.UpsertWorkspace(ctx, workspace); err != nil {
		t.Fatal(err)
	}

	view := ViewDocument{
		ID:                 "view:board",
		Type:               "view",
		SchemaVersion:      1,
		WorkspaceID:        "workspace:ops",
		Name:               "Board",
		ViewType:           "board",
		Order:              10,
		VisiblePropertyIDs: []string{"property:name", "property:status"},
		HiddenPropertyIDs:  []string{},
		PropertyOrder:      map[string]int{"property:name": 10, "property:status": 20},
		ValueVisibility:    map[string]ValueVisibilityDocument{},
		CreatedAt:          "2026-05-14T00:00:00.000Z",
		UpdatedAt:          "2026-05-14T00:00:00.000Z",
	}
	if err := store.UpsertView(ctx, view); err != nil {
		t.Fatal(err)
	}

	views, err := store.ListViews(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 1 || views[0].ID != "view:board" {
		t.Fatalf("expected one active view, got %#v", views)
	}

	savedWorkspace, err := store.GetWorkspace(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if savedWorkspace.ActiveViewID != "view:board" {
		t.Fatalf("expected active view to persist, got %#v", savedWorkspace)
	}

	root, err := store.GetRoot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if root.ID != "workspace:root" || root.RootPath != "/tmp/workspace-root" {
		t.Fatalf("expected root document compatibility, got %#v", root)
	}
}

func TestStoreRejectsWorkspaceDocumentAtReservedRootID(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	if err := store.SetRoot(ctx, RootDocument{
		ID:       "workspace:other",
		RootPath: "/tmp/workspace-root",
		Name:     "workspace-root",
	}); err != nil {
		t.Fatal(err)
	}

	if err := store.UpsertWorkspace(ctx, WorkspaceDocument{
		ID:           "workspace:root",
		Type:         "workspace",
		ActiveViewID: "view:board",
	}); err == nil {
		t.Fatal("expected reserved workspace root id to be rejected")
	}

	workspace, err := store.GetWorkspace(ctx, "workspace:root")
	if err != nil {
		t.Fatal(err)
	}
	if workspace != (WorkspaceDocument{}) {
		t.Fatalf("expected reserved root id to return zero workspace, got %#v", workspace)
	}

	root, err := store.GetRoot(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if root.ID != "workspace:root" || root.RootPath != "/tmp/workspace-root" || root.Name != "workspace-root" {
		t.Fatalf("expected root document to remain intact, got %#v", root)
	}
}

func TestStoreReordersViews(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	for _, view := range []ViewDocument{
		{ID: "view:board", WorkspaceID: "workspace:ops", Name: "Board", ViewType: "board", Order: 10, CreatedAt: "2026-05-14T09:00:00.000Z", UpdatedAt: "2026-05-14T09:00:00.000Z"},
		{ID: "view:table", WorkspaceID: "workspace:ops", Name: "Table", ViewType: "table", Order: 20, CreatedAt: "2026-05-14T09:00:00.000Z", UpdatedAt: "2026-05-14T09:00:00.000Z"},
	} {
		if err := store.UpsertView(ctx, view); err != nil {
			t.Fatal(err)
		}
	}

	views, err := store.ReorderViews(ctx, "workspace:ops", []string{"view:table", "view:board"}, "2026-05-14T14:00:00.000Z")
	if err != nil {
		t.Fatal(err)
	}

	if len(views) != 2 || views[0].ID != "view:table" || views[0].Order != 10 || views[1].ID != "view:board" || views[1].Order != 20 {
		t.Fatalf("expected reordered views, got %#v", views)
	}
	if views[0].UpdatedAt != "2026-05-14T14:00:00.000Z" || views[1].UpdatedAt != "2026-05-14T14:00:00.000Z" {
		t.Fatalf("expected updated timestamps, got %#v", views)
	}
}

func TestStoreRejectsInvalidViewReorderWithoutMutation(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	for _, view := range []ViewDocument{
		{ID: "view:board", WorkspaceID: "workspace:ops", Name: "Board", ViewType: "board", Order: 10, CreatedAt: "2026-05-14T09:00:00.000Z", UpdatedAt: "2026-05-14T09:00:00.000Z"},
		{ID: "view:table", WorkspaceID: "workspace:ops", Name: "Table", ViewType: "table", Order: 20, CreatedAt: "2026-05-14T09:00:00.000Z", UpdatedAt: "2026-05-14T09:00:00.000Z"},
	} {
		if err := store.UpsertView(ctx, view); err != nil {
			t.Fatal(err)
		}
	}

	_, err = store.ReorderViews(ctx, "workspace:ops", []string{"view:table", "view:table"}, "2026-05-14T14:00:00.000Z")
	if !errors.Is(err, ErrInvalidViewOrder) {
		t.Fatalf("expected ErrInvalidViewOrder, got %v", err)
	}

	views, err := store.ListViews(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 2 || views[0].ID != "view:board" || views[0].Order != 10 || views[1].ID != "view:table" || views[1].Order != 20 {
		t.Fatalf("expected original order to remain, got %#v", views)
	}
	if views[0].UpdatedAt != "2026-05-14T09:00:00.000Z" || views[1].UpdatedAt != "2026-05-14T09:00:00.000Z" {
		t.Fatalf("expected timestamps to remain unchanged, got %#v", views)
	}
}
