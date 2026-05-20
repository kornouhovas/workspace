package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"workspace/internal/workspacestore"
)

func TestNormalizeCreatedPropertyDocumentAllowsDuplicateNamesByDistinctID(t *testing.T) {
	ctx := context.Background()
	store, err := workspacestore.Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	firstProperty := workspacestore.PropertyDefinitionDocument{
		WorkspaceID: "workspace:ops",
		Name:        "Text",
		Type:        "text",
	}
	if err := normalizeCreatedPropertyDocument(ctx, store, &firstProperty); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertPropertyDefinition(ctx, firstProperty); err != nil {
		t.Fatal(err)
	}

	secondProperty := workspacestore.PropertyDefinitionDocument{
		WorkspaceID: "workspace:ops",
		Name:        "Text",
		Type:        "text",
	}
	if err := normalizeCreatedPropertyDocument(ctx, store, &secondProperty); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertPropertyDefinition(ctx, secondProperty); err != nil {
		t.Fatal(err)
	}

	if firstProperty.ID == "" || secondProperty.ID == "" || firstProperty.ID == secondProperty.ID {
		t.Fatalf("expected distinct generated property ids, got %q and %q", firstProperty.ID, secondProperty.ID)
	}
	if firstProperty.Type != "propertyDefinition" || firstProperty.PropertyType != "text" {
		t.Fatalf("expected first property type normalization, got %#v", firstProperty)
	}
	if secondProperty.Type != "propertyDefinition" || secondProperty.PropertyType != "text" {
		t.Fatalf("expected second property type normalization, got %#v", secondProperty)
	}
	if firstProperty.Order != 10 || secondProperty.Order != 20 {
		t.Fatalf("expected order to advance by id-backed documents, got %d and %d", firstProperty.Order, secondProperty.Order)
	}
}

func TestNormalizeCreatedPropertyDocumentRejectsDuplicateID(t *testing.T) {
	ctx := context.Background()
	store, err := workspacestore.Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	existingProperty := workspacestore.PropertyDefinitionDocument{
		ID:           "property:client-generated",
		WorkspaceID:  "workspace:ops",
		Name:         "Text",
		PropertyType: "text",
	}
	if err := normalizeCreatedPropertyDocument(ctx, store, &existingProperty); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertPropertyDefinition(ctx, existingProperty); err != nil {
		t.Fatal(err)
	}

	duplicateProperty := workspacestore.PropertyDefinitionDocument{
		ID:           existingProperty.ID,
		WorkspaceID:  "workspace:ops",
		Name:         "Text",
		PropertyType: "text",
	}
	if err := normalizeCreatedPropertyDocument(ctx, store, &duplicateProperty); err == nil {
		t.Fatal("expected duplicate property id to be rejected")
	}
}

func TestCreateSelectValueFromServicePayload(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	if err := store.UpsertPropertyDefinition(ctx, workspacestore.PropertyDefinitionDocument{
		ID:           "property:priority",
		WorkspaceID:  "workspace:ops",
		Name:         "Priority",
		PropertyType: "select",
		Order:        10,
		CreatedAt:    "2026-05-15T09:00:00.000Z",
		UpdatedAt:    "2026-05-15T09:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}

	recorder := performJSONRequest(t, newWorkspaceMux(store), http.MethodPost, "/workspace/select-values", map[string]any{
		"workspaceId": "workspace:ops",
		"propertyId":  "property:priority",
		"name":        "High",
		"color":       "red",
	})
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected create select value to succeed, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response struct {
		SelectValue workspacestore.SelectValueDocument `json:"selectValue"`
	}
	decodeResponse(t, recorder, &response)
	if response.SelectValue.ID == "" || response.SelectValue.Type != "selectValue" || response.SelectValue.SchemaVersion != 1 {
		t.Fatalf("expected normalized select value document, got %#v", response.SelectValue)
	}
	if response.SelectValue.WorkspaceID != "workspace:ops" || response.SelectValue.PropertyID != "property:priority" {
		t.Fatalf("expected select value to target requested property, got %#v", response.SelectValue)
	}
	if response.SelectValue.Name != "High" || response.SelectValue.Color != "red" || response.SelectValue.Order != 10 {
		t.Fatalf("expected select value fields to be normalized, got %#v", response.SelectValue)
	}
	if response.SelectValue.CreatedAt == "" || response.SelectValue.UpdatedAt == "" {
		t.Fatalf("expected timestamps to be populated, got %#v", response.SelectValue)
	}
}

func TestUpdateProjectPropertyValueNormalizesAndPreservesCreatedAt(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	if err := store.UpsertPropertyDefinition(ctx, workspacestore.PropertyDefinitionDocument{
		ID:           "property:score",
		WorkspaceID:  "workspace:ops",
		Name:         "Score",
		PropertyType: "number",
		Order:        10,
		CreatedAt:    "2026-05-15T09:00:00.000Z",
		UpdatedAt:    "2026-05-15T09:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}

	mux := newWorkspaceMux(store)
	first := performJSONRequest(t, mux, http.MethodPut, "/workspace/property-values", map[string]any{
		"workspaceId": "workspace:ops",
		"projectId":   "project:alpha",
		"propertyId":  "property:score",
		"value":       "42.5",
	})
	if first.Code != http.StatusOK {
		t.Fatalf("expected first value update to succeed, got %d: %s", first.Code, first.Body.String())
	}
	values, err := store.ListPropertyValues(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 {
		t.Fatalf("expected one value after first update, got %#v", values)
	}
	createdAt := values[0].CreatedAt
	if values[0].ID == "" || values[0].Type != "projectPropertyValue" || values[0].SchemaVersion != 1 {
		t.Fatalf("expected normalized property value document, got %#v", values[0])
	}
	if values[0].ProjectID != "project:alpha" || values[0].PropertyID != "property:score" || values[0].PropertyType != "number" {
		t.Fatalf("expected project/property metadata, got %#v", values[0])
	}
	if values[0].Value != 42.5 {
		t.Fatalf("expected numeric value to be normalized, got %#v", values[0].Value)
	}

	second := performJSONRequest(t, mux, http.MethodPut, "/workspace/property-values", map[string]any{
		"workspaceId": "workspace:ops",
		"projectId":   "project:alpha",
		"propertyId":  "property:score",
		"value":       "100",
	})
	if second.Code != http.StatusOK {
		t.Fatalf("expected second value update to succeed, got %d: %s", second.Code, second.Body.String())
	}
	values, err = store.ListPropertyValues(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 {
		t.Fatalf("expected update to upsert stable value id, got %#v", values)
	}
	if values[0].CreatedAt != createdAt {
		t.Fatalf("expected createdAt to be preserved, got %q want %q", values[0].CreatedAt, createdAt)
	}
	if values[0].Value != float64(100) {
		t.Fatalf("expected updated numeric value, got %#v", values[0].Value)
	}
}

func TestUpdateProjectPropertyValueNormalizesNumberExpression(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	if err := store.UpsertPropertyDefinition(ctx, workspacestore.PropertyDefinitionDocument{
		ID:           "property:budget",
		WorkspaceID:  "workspace:ops",
		Name:         "Budget",
		PropertyType: "number",
		Order:        10,
		CreatedAt:    "2026-05-15T09:00:00.000Z",
		UpdatedAt:    "2026-05-15T09:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}

	recorder := performJSONRequest(t, newWorkspaceMux(store), http.MethodPut, "/workspace/property-values", map[string]any{
		"workspaceId": "workspace:ops",
		"projectId":   "project:alpha",
		"propertyId":  "property:budget",
		"value":       "=20/4+1",
	})
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected expression value update to succeed, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Value map[string]any `json:"value"`
	}
	decodeResponse(t, recorder, &response)
	if response.Value["expression"] != "=20/4+1" || response.Value["value"] != float64(6) {
		t.Fatalf("expected expression response value, got %#v", response.Value)
	}

	values, err := store.ListPropertyValues(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 {
		t.Fatalf("expected one value after expression update, got %#v", values)
	}
	expressionValue, ok := values[0].Value.(map[string]any)
	if !ok {
		t.Fatalf("expected stored expression object, got %#v", values[0].Value)
	}
	if expressionValue["expression"] != "=20/4+1" || expressionValue["value"] != float64(6) {
		t.Fatalf("expected stored expression value, got %#v", expressionValue)
	}

	bad := performJSONRequest(t, newWorkspaceMux(store), http.MethodPut, "/workspace/property-values", map[string]any{
		"workspaceId": "workspace:ops",
		"projectId":   "project:alpha",
		"propertyId":  "property:budget",
		"value":       "=1/0",
	})
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid expression to be rejected, got %d: %s", bad.Code, bad.Body.String())
	}
}

func TestSelectReferencesAreValidatedAndClearedOnDelete(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	if err := store.UpsertPropertyDefinition(ctx, workspacestore.PropertyDefinitionDocument{
		ID:           "property:tags",
		WorkspaceID:  "workspace:ops",
		Name:         "Tags",
		PropertyType: "multi-select",
		Order:        10,
		CreatedAt:    "2026-05-15T09:00:00.000Z",
		UpdatedAt:    "2026-05-15T09:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertSelectValue(ctx, workspacestore.SelectValueDocument{
		ID:          "selectValue:tags:bug",
		WorkspaceID: "workspace:ops",
		PropertyID:  "property:tags",
		Name:        "Bug",
		Order:       10,
		CreatedAt:   "2026-05-15T09:00:00.000Z",
		UpdatedAt:   "2026-05-15T09:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertView(ctx, workspacestore.ViewDocument{
		ID:          "view:table",
		WorkspaceID: "workspace:ops",
		Name:        "Table",
		ViewType:    "table",
		Order:       10,
		ValueVisibility: map[string]workspacestore.ValueVisibilityDocument{
			"property:tags": {
				Mode:     "include",
				ValueIDs: []string{"selectValue:tags:bug"},
			},
		},
		CreatedAt: "2026-05-15T09:00:00.000Z",
		UpdatedAt: "2026-05-15T09:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}

	mux := newWorkspaceMux(store)
	missing := performJSONRequest(t, mux, http.MethodPut, "/workspace/property-values", map[string]any{
		"workspaceId": "workspace:ops",
		"projectId":   "project:alpha",
		"propertyId":  "property:tags",
		"value":       []string{"selectValue:tags:missing"},
	})
	if missing.Code != http.StatusBadRequest {
		t.Fatalf("expected unknown select reference to be rejected, got %d: %s", missing.Code, missing.Body.String())
	}

	update := performJSONRequest(t, mux, http.MethodPut, "/workspace/property-values", map[string]any{
		"workspaceId": "workspace:ops",
		"projectId":   "project:alpha",
		"propertyId":  "property:tags",
		"value":       []string{"selectValue:tags:bug", "selectValue:tags:bug"},
	})
	if update.Code != http.StatusOK {
		t.Fatalf("expected valid select reference to save, got %d: %s", update.Code, update.Body.String())
	}

	deleted := performJSONRequest(t, mux, http.MethodDelete, "/workspace/select-values", map[string]any{
		"workspaceId":         "workspace:ops",
		"selectValueId":       "selectValue:tags:bug",
		"confirmDeleteUsages": true,
	})
	if deleted.Code != http.StatusOK {
		t.Fatalf("expected select value delete to succeed, got %d: %s", deleted.Code, deleted.Body.String())
	}
	values, err := store.ListPropertyValues(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 {
		t.Fatalf("expected one property value after delete, got %#v", values)
	}
	if selected, ok := values[0].Value.([]any); !ok || len(selected) != 0 {
		t.Fatalf("expected deleted multi-select reference to be cleared, got %#v", values[0].Value)
	}
	views, err := store.ListViews(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := views[0].ValueVisibility["property:tags"]; ok {
		t.Fatalf("expected deleted select value to clear empty view filter, got %#v", views[0].ValueVisibility)
	}
}

func TestDeletePropertyCascadesValuesAndSelectValues(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	if err := store.UpsertPropertyDefinition(ctx, workspacestore.PropertyDefinitionDocument{
		ID:           "property:priority",
		WorkspaceID:  "workspace:ops",
		Name:         "Priority",
		PropertyType: "select",
		Order:        10,
		CreatedAt:    "2026-05-15T09:00:00.000Z",
		UpdatedAt:    "2026-05-15T09:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertSelectValue(ctx, workspacestore.SelectValueDocument{
		ID:          "selectValue:priority:high",
		WorkspaceID: "workspace:ops",
		PropertyID:  "property:priority",
		Name:        "High",
		Order:       10,
		CreatedAt:   "2026-05-15T09:00:00.000Z",
		UpdatedAt:   "2026-05-15T09:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertPropertyValue(ctx, workspacestore.PropertyValueDocument{
		ID:            "propertyValue:existing",
		WorkspaceID:   "workspace:ops",
		ProjectID:     "project:alpha",
		PropertyID:    "property:priority",
		Type:          "projectPropertyValue",
		SchemaVersion: 1,
		PropertyType:  "select",
		Value:         "selectValue:priority:high",
		CreatedAt:     "2026-05-15T09:00:00.000Z",
		UpdatedAt:     "2026-05-15T09:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertView(ctx, workspacestore.ViewDocument{
		ID:                 "view:table",
		WorkspaceID:        "workspace:ops",
		Name:               "Table",
		ViewType:           "table",
		Order:              10,
		VisiblePropertyIDs: []string{"property:name", "property:priority"},
		HiddenPropertyIDs:  []string{"property:priority"},
		PropertyOrder: map[string]int{
			"property:name":     10,
			"property:priority": 20,
		},
		ValueVisibility: map[string]workspacestore.ValueVisibilityDocument{
			"property:priority": {
				Mode:     "include",
				ValueIDs: []string{"selectValue:priority:high"},
			},
		},
		CreatedAt: "2026-05-15T09:00:00.000Z",
		UpdatedAt: "2026-05-15T09:00:00.000Z",
	}); err != nil {
		t.Fatal(err)
	}

	recorder := performJSONRequest(t, newWorkspaceMux(store), http.MethodDelete, "/workspace/properties", map[string]any{
		"workspaceId":         "workspace:ops",
		"propertyId":          "property:priority",
		"confirmDeleteValues": true,
	})
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected property delete to succeed, got %d: %s", recorder.Code, recorder.Body.String())
	}
	properties, err := store.ListPropertyDefinitions(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(properties) != 0 {
		t.Fatalf("expected deleted property to be hidden from active list, got %#v", properties)
	}
	selectValues, err := store.ListSelectValues(ctx, "workspace:ops", "property:priority")
	if err != nil {
		t.Fatal(err)
	}
	if len(selectValues) != 0 {
		t.Fatalf("expected property select values to be hidden from active list, got %#v", selectValues)
	}
	values, err := store.ListPropertyValues(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 0 {
		t.Fatalf("expected property values to be hidden from active list, got %#v", values)
	}
	views, err := store.ListViews(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 1 {
		t.Fatalf("expected one view after property delete, got %#v", views)
	}
	if containsString(views[0].VisiblePropertyIDs, "property:priority") || containsString(views[0].HiddenPropertyIDs, "property:priority") {
		t.Fatalf("expected deleted property to be removed from view property lists, got %#v", views[0])
	}
	if _, ok := views[0].PropertyOrder["property:priority"]; ok {
		t.Fatalf("expected deleted property to be removed from view property order, got %#v", views[0].PropertyOrder)
	}
	if _, ok := views[0].ValueVisibility["property:priority"]; ok {
		t.Fatalf("expected deleted property to be removed from view value visibility, got %#v", views[0].ValueVisibility)
	}
}

func TestReorderPropertiesRejectsIncompleteOrderWithoutPartialUpdate(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t, ctx)
	for _, property := range []workspacestore.PropertyDefinitionDocument{
		{ID: "property:first", WorkspaceID: "workspace:ops", Name: "First", PropertyType: "text", Order: 10, CreatedAt: "2026-05-15T09:00:00.000Z", UpdatedAt: "2026-05-15T09:00:00.000Z"},
		{ID: "property:second", WorkspaceID: "workspace:ops", Name: "Second", PropertyType: "text", Order: 20, CreatedAt: "2026-05-15T09:00:00.000Z", UpdatedAt: "2026-05-15T09:00:00.000Z"},
	} {
		if err := store.UpsertPropertyDefinition(ctx, property); err != nil {
			t.Fatal(err)
		}
	}

	recorder := performJSONRequest(t, newWorkspaceMux(store), http.MethodPut, "/workspace/properties/reorder", map[string]any{
		"workspaceId":        "workspace:ops",
		"orderedPropertyIds": []string{"property:second"},
	})
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected incomplete reorder to be rejected, got %d: %s", recorder.Code, recorder.Body.String())
	}
	properties, err := store.ListPropertyDefinitions(ctx, "workspace:ops")
	if err != nil {
		t.Fatal(err)
	}
	if properties[0].ID != "property:first" || properties[0].Order != 10 || properties[1].ID != "property:second" || properties[1].Order != 20 {
		t.Fatalf("expected property order to remain unchanged, got %#v", properties)
	}
}

func openTestStore(t *testing.T, ctx context.Context) *workspacestore.Store {
	t.Helper()
	store, err := workspacestore.Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := store.Close(); err != nil {
			t.Fatal(err)
		}
	})
	return store
}

func performJSONRequest(t *testing.T, handler http.Handler, method string, path string, payload any) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(method, path, bytes.NewReader(body))
	request.Header.Set("content-type", "application/json")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func decodeResponse(t *testing.T, recorder *httptest.ResponseRecorder, target any) {
	t.Helper()
	if err := json.NewDecoder(recorder.Body).Decode(target); err != nil {
		t.Fatal(err)
	}
}

func containsString(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}
