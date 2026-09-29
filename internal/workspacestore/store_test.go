package workspacestore

import (
	"context"
	"errors"
	"path/filepath"
	"reflect"
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
		BoardLayout:        BoardLayoutDocument{ColumnWidth: 384},
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
	if views[0].BoardLayout.ColumnWidth != 384 {
		t.Fatalf("expected Board column width to persist, got %#v", views[0].BoardLayout)
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
		{ID: "view:foreign", WorkspaceID: "workspace:other", Name: "Foreign", ViewType: "board", Order: 10, CreatedAt: "2026-05-14T09:00:00.000Z", UpdatedAt: "2026-05-14T09:00:00.000Z"},
		{ID: "view:deleted", WorkspaceID: "workspace:ops", Name: "Deleted", ViewType: "board", Order: 30, CreatedAt: "2026-05-14T09:00:00.000Z", UpdatedAt: "2026-05-14T09:00:00.000Z", DeletedAt: stringPtr("2026-05-14T10:00:00.000Z")},
	} {
		if err := store.UpsertView(ctx, view); err != nil {
			t.Fatal(err)
		}
	}

	tests := []struct {
		name          string
		orderedViews  []string
		expectedError error
	}{
		{name: "duplicate active id", orderedViews: []string{"view:table", "view:table"}, expectedError: ErrInvalidViewOrder},
		{name: "missing active id", orderedViews: []string{"view:table"}, expectedError: ErrInvalidViewOrder},
		{name: "extra foreign id", orderedViews: []string{"view:table", "view:foreign"}, expectedError: ErrInvalidViewOrder},
		{name: "deleted id", orderedViews: []string{"view:table", "view:deleted"}, expectedError: ErrInvalidViewOrder},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err = store.ReorderViews(ctx, "workspace:ops", tt.orderedViews, "2026-05-14T14:00:00.000Z")
			if !errors.Is(err, tt.expectedError) {
				t.Fatalf("expected %v, got %v", tt.expectedError, err)
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

			deletedView, err := store.GetView(ctx, "view:deleted")
			if err != nil {
				t.Fatal(err)
			}
			if deletedView.Order != 30 || deletedView.UpdatedAt != "2026-05-14T09:00:00.000Z" || deletedView.DeletedAt == nil {
				t.Fatalf("expected deleted view to remain unchanged, got %#v", deletedView)
			}
		})
	}
}

func TestStorePersistsCustomPropertyDocuments(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	deletedAt := "2026-05-15T10:00:00.000Z"
	for _, property := range []PropertyDefinitionDocument{
		{
			ID:            "property:name",
			Type:          "propertyDefinition",
			SchemaVersion: 1,
			WorkspaceID:   "workspace:ops",
			Name:          "Name",
			PropertyType:  "text",
			System:        true,
			Order:         10,
			CreatedAt:     "2026-05-15T09:00:00.000Z",
			UpdatedAt:     "2026-05-15T09:00:00.000Z",
		},
		{
			ID:            "property:priority",
			Type:          "propertyDefinition",
			SchemaVersion: 1,
			WorkspaceID:   "workspace:ops",
			Name:          "Priority",
			PropertyType:  "select",
			Order:         30,
			CreatedAt:     "2026-05-15T09:00:00.000Z",
			UpdatedAt:     "2026-05-15T09:00:00.000Z",
		},
		{
			ID:            "property:archived",
			Type:          "propertyDefinition",
			SchemaVersion: 1,
			WorkspaceID:   "workspace:ops",
			Name:          "Archived",
			PropertyType:  "text",
			Order:         40,
			CreatedAt:     "2026-05-15T09:00:00.000Z",
			UpdatedAt:     "2026-05-15T09:00:00.000Z",
			DeletedAt:     &deletedAt,
		},
		{
			ID:            "property:foreign",
			Type:          "propertyDefinition",
			SchemaVersion: 1,
			WorkspaceID:   "workspace:other",
			Name:          "Foreign",
			PropertyType:  "text",
			Order:         10,
			CreatedAt:     "2026-05-15T09:00:00.000Z",
			UpdatedAt:     "2026-05-15T09:00:00.000Z",
		},
	} {
		if err := store.UpsertPropertyDefinition(ctx, property); err != nil {
			t.Fatal(err)
		}
	}

	properties, err := store.ListPropertyDefinitions(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(properties) != 2 || properties[0].ID != "property:name" || properties[1].ID != "property:priority" {
		t.Fatalf("expected active properties sorted by order, got %#v", properties)
	}

	for _, value := range []SelectValueDocument{
		{
			ID:            "selectValue:priority:high",
			Type:          "selectValue",
			SchemaVersion: 1,
			WorkspaceID:   "workspace:ops",
			PropertyID:    "property:priority",
			Name:          "High",
			Color:         "red",
			Order:         20,
			CreatedAt:     "2026-05-15T09:00:00.000Z",
			UpdatedAt:     "2026-05-15T09:00:00.000Z",
		},
		{
			ID:            "selectValue:priority:low",
			Type:          "selectValue",
			SchemaVersion: 1,
			WorkspaceID:   "workspace:ops",
			PropertyID:    "property:priority",
			Name:          "Low",
			Color:         "green",
			Order:         10,
			CreatedAt:     "2026-05-15T09:00:00.000Z",
			UpdatedAt:     "2026-05-15T09:00:00.000Z",
		},
		{
			ID:            "selectValue:priority:archived",
			Type:          "selectValue",
			SchemaVersion: 1,
			WorkspaceID:   "workspace:ops",
			PropertyID:    "property:priority",
			Name:          "Archived",
			Order:         30,
			CreatedAt:     "2026-05-15T09:00:00.000Z",
			UpdatedAt:     "2026-05-15T09:00:00.000Z",
			DeletedAt:     &deletedAt,
		},
	} {
		if err := store.UpsertSelectValue(ctx, value); err != nil {
			t.Fatal(err)
		}
	}

	selectValues, err := store.ListSelectValues(ctx, "workspace:ops", "property:priority")
	if err != nil {
		t.Fatal(err)
	}
	if len(selectValues) != 2 || selectValues[0].ID != "selectValue:priority:low" || selectValues[1].ID != "selectValue:priority:high" {
		t.Fatalf("expected active select values sorted by order, got %#v", selectValues)
	}

	for _, value := range []PropertyValueDocument{
		{
			ID:          "propertyValue:project-alpha:property-priority",
			WorkspaceID: "workspace:ops",
			ObjectID:    "object:project-alpha",
			ProjectID:   "project:alpha",
			PropertyID:  "property:priority",
			Type:        "select",
			Value:       "selectValue:priority:high",
			CreatedAt:   "2026-05-15T09:00:00.000Z",
			UpdatedAt:   "2026-05-15T09:00:00.000Z",
		},
		{
			ID:          "propertyValue:project-beta:property-priority",
			WorkspaceID: "workspace:ops",
			ObjectID:    "object:project-beta",
			ProjectID:   "project:beta",
			PropertyID:  "property:priority",
			Type:        "select",
			Value:       "selectValue:priority:low",
			CreatedAt:   "2026-05-15T09:00:00.000Z",
			UpdatedAt:   "2026-05-15T09:00:00.000Z",
			DeletedAt:   &deletedAt,
		},
	} {
		if err := store.UpsertPropertyValue(ctx, value); err != nil {
			t.Fatal(err)
		}
	}

	propertyValues, err := store.ListPropertyValues(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(propertyValues) != 1 || propertyValues[0].ID != "propertyValue:project-alpha:property-priority" {
		t.Fatalf("expected active property values only, got %#v", propertyValues)
	}

	for _, event := range []PropertyHistoryDocument{
		{
			ID:            "propertyHistory:2",
			Type:          "propertyHistory",
			SchemaVersion: 1,
			WorkspaceID:   "workspace:ops",
			ProjectID:     "project:alpha",
			PropertyID:    "property:priority",
			TargetType:    "propertyValue",
			TargetID:      "propertyValue:project-alpha:property-priority",
			Action:        "valueChanged",
			PreviousValue: nil,
			NextValue:     "selectValue:priority:high",
			CreatedAt:     "2026-05-15T10:00:00.000Z",
		},
		{
			ID:            "propertyHistory:1",
			Type:          "propertyHistory",
			SchemaVersion: 1,
			WorkspaceID:   "workspace:ops",
			PropertyID:    "property:priority",
			TargetType:    "propertyDefinition",
			TargetID:      "property:priority",
			Action:        "created",
			PreviousValue: nil,
			NextValue:     "Priority",
			CreatedAt:     "2026-05-15T09:00:00.000Z",
		},
		{
			ID:            "propertyHistory:foreign",
			Type:          "propertyHistory",
			SchemaVersion: 1,
			WorkspaceID:   "workspace:other",
			PropertyID:    "property:foreign",
			TargetType:    "propertyDefinition",
			TargetID:      "property:foreign",
			Action:        "created",
			NextValue:     "Foreign",
			CreatedAt:     "2026-05-15T08:00:00.000Z",
		},
	} {
		if err := store.AppendPropertyHistory(ctx, event); err != nil {
			t.Fatal(err)
		}
	}

	history, err := store.ListPropertyHistory(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 2 || history[0].ID != "propertyHistory:1" || history[1].ID != "propertyHistory:2" {
		t.Fatalf("expected workspace-scoped property history sorted by createdAt, got %#v", history)
	}
}

func stringPtr(value string) *string {
	return &value
}

func TestTableGroupingPersistsAcrossReopen(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "grouping.db")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	grouping := &GroupingDocument{PropertyID: "property:tags", Sort: "manual", ManualOrder: []string{"value:one"}, HiddenGroupIDs: []string{"empty"}, CollapsedGroupIDs: []string{"value:one"}, HideEmpty: true}
	if err := store.UpsertView(ctx, ViewDocument{ID: "view:table", WorkspaceID: "workspace:a", ViewType: "table", Grouping: grouping}); err != nil {
		t.Fatal(err)
	}
	store.Close()
	store, err = Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	got, err := store.GetView(ctx, "view:table")
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got.Grouping, grouping) {
		t.Fatalf("grouping lost after reopen: %#v", got.Grouping)
	}
}
