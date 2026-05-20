package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"workspace/internal/workspacestore"
)

func main() {
	dbPath := flag.String("db", "workspace.db", "path to any-store database")
	addr := flag.String("addr", "127.0.0.1:0", "listen address")
	flag.Parse()

	ctx := context.Background()
	store, err := workspacestore.Open(ctx, *dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	mux := newWorkspaceMux(store)
	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("workspace-sidecar listening on %s", listener.Addr().String())
	log.Fatal(http.Serve(listener, mux))
}

func newWorkspaceMux(store *workspacestore.Store) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	mux.HandleFunc("/workspace/root", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			root, err := store.GetRoot(r.Context())
			writeResult(w, root, err)
		case http.MethodPut:
			var root workspacestore.RootDocument
			if err := json.NewDecoder(r.Body).Decode(&root); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			writeResult(w, map[string]any{"ok": true}, store.SetRoot(r.Context(), root))
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		}
	})
	mux.HandleFunc("/workspace/property-values", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			workspaceID := r.URL.Query().Get("workspaceId")
			if workspaceID == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspaceId is required"})
				return
			}
			values, err := store.ListPropertyValues(r.Context(), workspaceID)
			if values == nil {
				values = []workspacestore.PropertyValueDocument{}
			}
			writeResult(w, map[string]any{"values": values}, err)
			return
		}

		if r.Method != http.MethodPut {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}

		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		value, err := normalizeProjectPropertyValueDocument(r.Context(), store, payload)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		writeResult(w, map[string]any{
			"ok":          true,
			"workspaceId": value.WorkspaceID,
			"projectId":   value.ProjectID,
			"propertyId":  value.PropertyID,
			"value":       value.Value,
			"updatedAt":   value.UpdatedAt,
		}, store.UpsertPropertyValue(r.Context(), value))
	})
	mux.HandleFunc("/workspace/properties/reorder", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}

		var payload struct {
			WorkspaceID        string   `json:"workspaceId"`
			OrderedPropertyIDs []string `json:"orderedPropertyIds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		if payload.WorkspaceID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspaceId is required"})
			return
		}
		if payload.OrderedPropertyIDs == nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "orderedPropertyIds is required"})
			return
		}

		properties, err := store.ListPropertyDefinitions(r.Context(), payload.WorkspaceID)
		if err != nil {
			writeResult(w, nil, err)
			return
		}
		propertiesByID := make(map[string]workspacestore.PropertyDefinitionDocument, len(properties))
		for _, property := range properties {
			propertiesByID[property.ID] = property
		}
		if err := validateCompleteDocumentOrder(payload.OrderedPropertyIDs, propertiesByID); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}

		timestamp := time.Now().UTC().Format(time.RFC3339Nano)
		reordered := make([]workspacestore.PropertyDefinitionDocument, 0, len(payload.OrderedPropertyIDs))
		for index, propertyID := range payload.OrderedPropertyIDs {
			property := propertiesByID[propertyID]
			property.Order = (index + 1) * 10
			property.UpdatedAt = timestamp
			reordered = append(reordered, property)
		}
		if err := store.UpsertPropertyDefinitions(r.Context(), reordered); err != nil {
			writeResult(w, nil, err)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"properties": reordered})
	})
	mux.HandleFunc("/workspace/properties", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			workspaceID := r.URL.Query().Get("workspaceId")
			if workspaceID == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspaceId is required"})
				return
			}
			properties, err := store.ListPropertyDefinitions(r.Context(), workspaceID)
			if err != nil {
				writeResult(w, nil, err)
				return
			}
			selectValues, err := store.ListSelectValues(r.Context(), workspaceID, "")
			if err != nil {
				writeResult(w, nil, err)
				return
			}
			if properties == nil {
				properties = []workspacestore.PropertyDefinitionDocument{}
			}
			if selectValues == nil {
				selectValues = []workspacestore.SelectValueDocument{}
			}
			writeJSON(w, http.StatusOK, map[string]any{"properties": properties, "selectValues": selectValues})
		case http.MethodPost:
			var property workspacestore.PropertyDefinitionDocument
			if err := json.NewDecoder(r.Body).Decode(&property); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			if err := normalizeCreatedPropertyDocument(r.Context(), store, &property); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			writeResult(w, map[string]any{"ok": true, "property": property}, store.UpsertPropertyDefinition(r.Context(), property))
		case http.MethodPatch:
			var payload struct {
				WorkspaceID string         `json:"workspaceId"`
				PropertyID  string         `json:"propertyId"`
				Patch       map[string]any `json:"patch"`
			}
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			property, ok, err := findPropertyDefinition(r.Context(), store, payload.WorkspaceID, payload.PropertyID)
			if err != nil {
				writeResult(w, nil, err)
				return
			}
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "property was not found"})
				return
			}
			applyPropertyPatch(&property, payload.Patch, time.Now().UTC().Format(time.RFC3339Nano))
			writeResult(w, map[string]any{"ok": true, "property": property}, store.UpsertPropertyDefinition(r.Context(), property))
		case http.MethodDelete:
			var payload struct {
				WorkspaceID         string `json:"workspaceId"`
				PropertyID          string `json:"propertyId"`
				ConfirmDeleteValues bool   `json:"confirmDeleteValues"`
			}
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			property, ok, err := findPropertyDefinition(r.Context(), store, payload.WorkspaceID, payload.PropertyID)
			if err != nil {
				writeResult(w, nil, err)
				return
			}
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "property was not found"})
				return
			}
			timestamp := time.Now().UTC().Format(time.RFC3339Nano)
			property.DeletedAt = &timestamp
			property.UpdatedAt = timestamp
			if err := cascadeDeleteProperty(r.Context(), store, property, timestamp, payload.ConfirmDeleteValues); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "workspaceId": payload.WorkspaceID, "deletedPropertyId": payload.PropertyID})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		}
	})
	mux.HandleFunc("/workspace/select-values/reorder", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}

		var payload struct {
			WorkspaceID           string   `json:"workspaceId"`
			PropertyID            string   `json:"propertyId"`
			OrderedSelectValueIDs []string `json:"orderedSelectValueIds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		if payload.WorkspaceID == "" || payload.PropertyID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspaceId and propertyId are required"})
			return
		}

		values, err := store.ListSelectValues(r.Context(), payload.WorkspaceID, payload.PropertyID)
		if err != nil {
			writeResult(w, nil, err)
			return
		}
		valuesByID := make(map[string]workspacestore.SelectValueDocument, len(values))
		for _, value := range values {
			valuesByID[value.ID] = value
		}
		if err := validateCompleteDocumentOrder(payload.OrderedSelectValueIDs, valuesByID); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}

		timestamp := time.Now().UTC().Format(time.RFC3339Nano)
		reordered := make([]workspacestore.SelectValueDocument, 0, len(payload.OrderedSelectValueIDs))
		for index, valueID := range payload.OrderedSelectValueIDs {
			value := valuesByID[valueID]
			value.Order = (index + 1) * 10
			value.UpdatedAt = timestamp
			reordered = append(reordered, value)
		}
		if err := store.UpsertSelectValues(r.Context(), reordered); err != nil {
			writeResult(w, nil, err)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"selectValues": reordered})
	})
	mux.HandleFunc("/workspace/select-values", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			var payload map[string]any
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			value, err := normalizeCreatedSelectValueDocument(r.Context(), store, payload)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			writeResult(w, map[string]any{"ok": true, "selectValue": value}, store.UpsertSelectValue(r.Context(), value))
		case http.MethodPatch:
			var payload struct {
				WorkspaceID   string         `json:"workspaceId"`
				SelectValueID string         `json:"selectValueId"`
				Patch         map[string]any `json:"patch"`
			}
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			value, ok, err := findSelectValue(r.Context(), store, payload.WorkspaceID, payload.SelectValueID)
			if err != nil {
				writeResult(w, nil, err)
				return
			}
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "select value was not found"})
				return
			}
			applySelectValuePatch(&value, payload.Patch, time.Now().UTC().Format(time.RFC3339Nano))
			writeResult(w, map[string]any{"ok": true, "selectValue": value}, store.UpsertSelectValue(r.Context(), value))
		case http.MethodDelete:
			var payload struct {
				WorkspaceID         string `json:"workspaceId"`
				SelectValueID       string `json:"selectValueId"`
				ConfirmDeleteUsages bool   `json:"confirmDeleteUsages"`
			}
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			value, ok, err := findSelectValue(r.Context(), store, payload.WorkspaceID, payload.SelectValueID)
			if err != nil {
				writeResult(w, nil, err)
				return
			}
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "select value was not found"})
				return
			}
			timestamp := time.Now().UTC().Format(time.RFC3339Nano)
			value.DeletedAt = &timestamp
			value.UpdatedAt = timestamp
			if err := cascadeDeleteSelectValue(r.Context(), store, value, timestamp, payload.ConfirmDeleteUsages); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "workspaceId": payload.WorkspaceID, "deletedSelectValueId": value.ID})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		}
	})
	mux.HandleFunc("/workspace/views/reorder", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}

		var payload struct {
			WorkspaceID    string   `json:"workspaceId"`
			OrderedViewIDs []string `json:"orderedViewIds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		if payload.WorkspaceID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspaceId is required"})
			return
		}
		if payload.WorkspaceID == "workspace:root" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspaceId is reserved"})
			return
		}
		if payload.OrderedViewIDs == nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "orderedViewIds is required"})
			return
		}

		workspace, err := store.GetWorkspace(r.Context(), payload.WorkspaceID)
		if err != nil {
			writeResult(w, nil, err)
			return
		}
		if workspace.ID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspace was not found"})
			return
		}

		views, err := store.ReorderViews(r.Context(), payload.WorkspaceID, payload.OrderedViewIDs, time.Now().UTC().Format(time.RFC3339Nano))
		if err != nil {
			writeResult(w, nil, err)
			return
		}

		responseViews := make([]map[string]any, 0, len(views))
		for _, view := range views {
			responseViews = append(responseViews, map[string]any{
				"id":    view.ID,
				"order": view.Order,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"views": responseViews})
	})
	mux.HandleFunc("/workspace/views", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			workspaceID := r.URL.Query().Get("workspaceId")
			if workspaceID == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspaceId is required"})
				return
			}
			views, err := store.ListViews(r.Context(), workspaceID)
			if views == nil {
				views = []workspacestore.ViewDocument{}
			}
			writeResult(w, map[string]any{"views": views}, err)
			return
		}

		if r.Method != http.MethodPut {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}

		var view workspacestore.ViewDocument
		if err := json.NewDecoder(r.Body).Decode(&view); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		writeResult(w, map[string]any{"ok": true}, store.UpsertView(r.Context(), view))
	})
	mux.HandleFunc("/workspace/active-view", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}

		var payload struct {
			WorkspaceID string `json:"workspaceId"`
			ViewID      string `json:"viewId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		if payload.WorkspaceID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspaceId is required"})
			return
		}
		if payload.ViewID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "viewId is required"})
			return
		}
		if payload.ViewID == "workspace:root" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspace:root is reserved"})
			return
		}
		if payload.WorkspaceID == "workspace:root" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "workspaceId is reserved"})
			return
		}

		view, err := store.GetView(r.Context(), payload.ViewID)
		if err != nil {
			writeResult(w, nil, err)
			return
		}
		if view.ID == "" || view.WorkspaceID != payload.WorkspaceID || view.DeletedAt != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "view was not found"})
			return
		}

		workspace, err := store.GetWorkspace(r.Context(), payload.WorkspaceID)
		if err != nil {
			writeResult(w, nil, err)
			return
		}
		if workspace.ID == "" {
			workspace = workspacestore.WorkspaceDocument{
				ID:            payload.WorkspaceID,
				Type:          "workspace",
				SchemaVersion: 1,
			}
		}
		workspace.ActiveViewID = payload.ViewID
		writeResult(w, map[string]any{"ok": true}, store.UpsertWorkspace(r.Context(), workspace))
	})

	return mux
}

func normalizePropertyDocumentType(property *workspacestore.PropertyDefinitionDocument) {
	if property.PropertyType == "" && property.Type != "" && property.Type != "propertyDefinition" {
		property.PropertyType = property.Type
		property.Type = "propertyDefinition"
	}
	if property.Type == "" {
		property.Type = "propertyDefinition"
	}
}

func normalizeCreatedPropertyDocument(ctx context.Context, store *workspacestore.Store, property *workspacestore.PropertyDefinitionDocument) error {
	property.ID = strings.TrimSpace(property.ID)
	property.WorkspaceID = strings.TrimSpace(property.WorkspaceID)
	property.Name = strings.TrimSpace(property.Name)
	property.PropertyType = strings.TrimSpace(property.PropertyType)
	normalizePropertyDocumentType(property)

	if property.WorkspaceID == "" {
		return errors.New("workspaceId is required")
	}
	if property.Name == "" {
		return errors.New("name is required")
	}
	if !isSupportedPropertyType(property.PropertyType) {
		return fmt.Errorf("unsupported property type: %s", property.PropertyType)
	}
	if property.ID == "" {
		id, err := createRandomDocumentID("property")
		if err != nil {
			return err
		}
		property.ID = id
	}

	properties, err := store.ListPropertyDefinitions(ctx, property.WorkspaceID)
	if err != nil {
		return err
	}
	for _, existingProperty := range properties {
		if existingProperty.ID == property.ID {
			return errors.New("property already exists")
		}
	}

	if property.SchemaVersion == 0 {
		property.SchemaVersion = 1
	}
	if property.Order == 0 {
		maxOrder := 0
		for _, existingProperty := range properties {
			if existingProperty.Order > maxOrder {
				maxOrder = existingProperty.Order
			}
		}
		property.Order = maxOrder + 10
	}
	if property.Config == nil {
		property.Config = map[string]any{}
	}

	timestamp := time.Now().UTC().Format(time.RFC3339Nano)
	if property.CreatedAt == "" {
		property.CreatedAt = timestamp
	}
	if property.UpdatedAt == "" {
		property.UpdatedAt = timestamp
	}
	return nil
}

func isSupportedPropertyType(propertyType string) bool {
	switch propertyType {
	case "text", "number", "date", "select", "multi-select":
		return true
	default:
		return false
	}
}

func normalizeCreatedSelectValueDocument(ctx context.Context, store *workspacestore.Store, payload map[string]any) (workspacestore.SelectValueDocument, error) {
	workspaceID := getStringPayload(payload, "workspaceId")
	propertyID := getStringPayload(payload, "propertyId")
	name := strings.TrimSpace(getStringPayload(payload, "name"))
	if workspaceID == "" || propertyID == "" {
		return workspacestore.SelectValueDocument{}, errors.New("workspaceId and propertyId are required")
	}
	if name == "" {
		return workspacestore.SelectValueDocument{}, errors.New("name is required")
	}
	property, ok, err := findPropertyDefinition(ctx, store, workspaceID, propertyID)
	if err != nil {
		return workspacestore.SelectValueDocument{}, err
	}
	if !ok {
		return workspacestore.SelectValueDocument{}, errors.New("property was not found")
	}
	propertyType := getPropertyDefinitionType(property)
	if propertyType != "select" && propertyType != "multi-select" {
		return workspacestore.SelectValueDocument{}, errors.New("property must be select or multi-select")
	}
	existingValues, err := store.ListSelectValues(ctx, workspaceID, propertyID)
	if err != nil {
		return workspacestore.SelectValueDocument{}, err
	}

	id := getStringPayload(payload, "selectValueId")
	if id == "" {
		id = getStringPayload(payload, "id")
	}
	if id == "" {
		generatedID, err := createRandomDocumentID("selectValue")
		if err != nil {
			return workspacestore.SelectValueDocument{}, err
		}
		id = generatedID
	}
	id = normalizeDocumentID("selectValue", id)
	for _, existingValue := range existingValues {
		if existingValue.ID == id {
			return workspacestore.SelectValueDocument{}, errors.New("select value already exists")
		}
	}

	order := getNumberPayload(payload, "order", 0)
	if order == 0 {
		for _, existingValue := range existingValues {
			if existingValue.Order > order {
				order = existingValue.Order
			}
		}
		order += 10
	}
	timestamp := time.Now().UTC().Format(time.RFC3339Nano)
	return workspacestore.SelectValueDocument{
		ID:            id,
		Type:          "selectValue",
		SchemaVersion: 1,
		WorkspaceID:   workspaceID,
		PropertyID:    propertyID,
		Name:          name,
		Color:         getStringPayload(payload, "color"),
		Hidden:        getBoolPayload(payload, "hidden"),
		Order:         order,
		CreatedAt:     timestamp,
		UpdatedAt:     timestamp,
	}, nil
}

func normalizeProjectPropertyValueDocument(ctx context.Context, store *workspacestore.Store, payload map[string]any) (workspacestore.PropertyValueDocument, error) {
	workspaceID := getStringPayload(payload, "workspaceId")
	projectID := getStringPayload(payload, "projectId")
	propertyID := getStringPayload(payload, "propertyId")
	if workspaceID == "" {
		return workspacestore.PropertyValueDocument{}, errors.New("workspaceId is required")
	}
	if projectID == "" {
		return workspacestore.PropertyValueDocument{}, errors.New("projectId is required")
	}
	if propertyID == "" {
		return workspacestore.PropertyValueDocument{}, errors.New("propertyId is required")
	}
	property, ok, err := findPropertyDefinition(ctx, store, workspaceID, propertyID)
	if err != nil {
		return workspacestore.PropertyValueDocument{}, err
	}
	if !ok {
		return workspacestore.PropertyValueDocument{}, errors.New("property was not found")
	}
	propertyType := getPropertyDefinitionType(property)
	normalizedValue, err := normalizePropertyValueByType(ctx, store, workspaceID, propertyID, propertyType, payload["value"])
	if err != nil {
		return workspacestore.PropertyValueDocument{}, err
	}

	timestamp := time.Now().UTC().Format(time.RFC3339Nano)
	existingValues, err := store.ListPropertyValues(ctx, workspaceID)
	if err != nil {
		return workspacestore.PropertyValueDocument{}, err
	}
	id := createStableDocumentID("propertyValue", workspaceID, projectID, propertyID)
	createdAt := timestamp
	for _, existingValue := range existingValues {
		if existingValue.ProjectID == projectID && existingValue.PropertyID == propertyID {
			id = existingValue.ID
			if existingValue.CreatedAt != "" {
				createdAt = existingValue.CreatedAt
			}
			break
		}
	}

	return workspacestore.PropertyValueDocument{
		ID:            id,
		WorkspaceID:   workspaceID,
		ObjectID:      projectID,
		ProjectID:     projectID,
		PropertyID:    propertyID,
		Type:          "projectPropertyValue",
		SchemaVersion: 1,
		PropertyType:  propertyType,
		Value:         normalizedValue,
		CreatedAt:     createdAt,
		UpdatedAt:     timestamp,
	}, nil
}

func normalizePropertyValueByType(ctx context.Context, store *workspacestore.Store, workspaceID string, propertyID string, propertyType string, value any) (any, error) {
	switch propertyType {
	case "number":
		return normalizeNumberPropertyValue(value), nil
	case "date":
		return normalizeDatePropertyValue(value), nil
	case "select":
		valueID := normalizeSelectValueID(value)
		if valueID == nil {
			return nil, nil
		}
		if err := validateSelectValueReference(ctx, store, workspaceID, propertyID, *valueID); err != nil {
			return nil, err
		}
		return *valueID, nil
	case "multi-select":
		valueIDs := normalizeMultiSelectValueIDs(value)
		for _, valueID := range valueIDs {
			if err := validateSelectValueReference(ctx, store, workspaceID, propertyID, valueID); err != nil {
				return nil, err
			}
		}
		values := make([]any, len(valueIDs))
		for index, valueID := range valueIDs {
			values[index] = valueID
		}
		return values, nil
	case "text":
		if value == nil {
			return "", nil
		}
		return fmt.Sprint(value), nil
	default:
		return nil, fmt.Errorf("unsupported property type: %s", propertyType)
	}
}

func normalizeNumberPropertyValue(value any) any {
	if value == nil {
		return nil
	}
	switch typedValue := value.(type) {
	case float64:
		return typedValue
	case string:
		trimmedValue := strings.TrimSpace(typedValue)
		if trimmedValue == "" {
			return nil
		}
		number, err := strconv.ParseFloat(trimmedValue, 64)
		if err != nil {
			return nil
		}
		return number
	default:
		return nil
	}
}

func normalizeDatePropertyValue(value any) any {
	text, ok := value.(string)
	if !ok {
		return nil
	}
	if _, err := time.Parse("2006-01-02", text); err != nil {
		return nil
	}
	return text
}

func normalizeSelectValueID(value any) *string {
	text, ok := value.(string)
	if !ok {
		return nil
	}
	trimmedValue := strings.TrimSpace(text)
	if trimmedValue == "" {
		return nil
	}
	return &trimmedValue
}

func normalizeMultiSelectValueIDs(value any) []string {
	var rawValues []any
	if values, ok := value.([]any); ok {
		rawValues = values
	} else {
		rawValues = []any{value}
	}
	seen := map[string]bool{}
	normalizedValues := []string{}
	for _, rawValue := range rawValues {
		valueID := normalizeSelectValueID(rawValue)
		if valueID == nil || seen[*valueID] {
			continue
		}
		seen[*valueID] = true
		normalizedValues = append(normalizedValues, *valueID)
	}
	return normalizedValues
}

func validateSelectValueReference(ctx context.Context, store *workspacestore.Store, workspaceID string, propertyID string, valueID string) error {
	values, err := store.ListSelectValues(ctx, workspaceID, propertyID)
	if err != nil {
		return err
	}
	for _, value := range values {
		if value.ID == valueID {
			return nil
		}
	}
	return fmt.Errorf("select value does not exist for property: %s", valueID)
}

func cascadeDeleteProperty(ctx context.Context, store *workspacestore.Store, property workspacestore.PropertyDefinitionDocument, timestamp string, confirmDeleteValues bool) error {
	propertyValues, err := store.ListPropertyValues(ctx, property.WorkspaceID)
	if err != nil {
		return err
	}
	valuesForProperty := []workspacestore.PropertyValueDocument{}
	for _, value := range propertyValues {
		if value.PropertyID == property.ID {
			valuesForProperty = append(valuesForProperty, value)
		}
	}
	if len(valuesForProperty) > 0 && !confirmDeleteValues {
		return errors.New("property has values and needs delete confirmation")
	}
	selectValues, err := store.ListSelectValues(ctx, property.WorkspaceID, property.ID)
	if err != nil {
		return err
	}
	deletedSelectValues := make([]workspacestore.SelectValueDocument, 0, len(selectValues))
	for _, selectValue := range selectValues {
		selectValue.DeletedAt = &timestamp
		selectValue.UpdatedAt = timestamp
		deletedSelectValues = append(deletedSelectValues, selectValue)
	}
	deletedPropertyValues := make([]workspacestore.PropertyValueDocument, 0, len(valuesForProperty))
	for _, value := range valuesForProperty {
		value.DeletedAt = &timestamp
		value.UpdatedAt = timestamp
		deletedPropertyValues = append(deletedPropertyValues, value)
	}
	views, err := store.ListViews(ctx, property.WorkspaceID)
	if err != nil {
		return err
	}
	updatedViews := []workspacestore.ViewDocument{}
	for _, view := range views {
		nextView, changed := removePropertyFromView(view, property.ID, timestamp)
		if changed {
			updatedViews = append(updatedViews, nextView)
		}
	}
	return store.UpsertWorkspaceDocumentBatch(ctx, workspacestore.WorkspaceDocumentBatch{
		PropertyDefinitions: []workspacestore.PropertyDefinitionDocument{property},
		SelectValues:        deletedSelectValues,
		PropertyValues:      deletedPropertyValues,
		Views:               updatedViews,
	})
}

func cascadeDeleteSelectValue(ctx context.Context, store *workspacestore.Store, selectValue workspacestore.SelectValueDocument, timestamp string, confirmDeleteUsages bool) error {
	property, ok, err := findPropertyDefinition(ctx, store, selectValue.WorkspaceID, selectValue.PropertyID)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("property was not found")
	}
	propertyValues, err := store.ListPropertyValues(ctx, selectValue.WorkspaceID)
	if err != nil {
		return err
	}
	valuesUsingSelectValue := []workspacestore.PropertyValueDocument{}
	for _, value := range propertyValues {
		if value.PropertyID == selectValue.PropertyID && propertyValueUsesSelectValue(value.Value, selectValue.ID) {
			valuesUsingSelectValue = append(valuesUsingSelectValue, value)
		}
	}
	if len(valuesUsingSelectValue) > 0 && !confirmDeleteUsages {
		return errors.New("select value is used by project property values and needs delete confirmation")
	}
	updatedPropertyValues := make([]workspacestore.PropertyValueDocument, 0, len(valuesUsingSelectValue))
	for _, value := range valuesUsingSelectValue {
		if getPropertyDefinitionType(property) == "multi-select" {
			value.Value = removeSelectValueFromMultiSelect(value.Value, selectValue.ID)
		} else {
			value.Value = nil
		}
		value.UpdatedAt = timestamp
		updatedPropertyValues = append(updatedPropertyValues, value)
	}
	views, err := store.ListViews(ctx, selectValue.WorkspaceID)
	if err != nil {
		return err
	}
	updatedViews := []workspacestore.ViewDocument{}
	for _, view := range views {
		nextView, changed := removeSelectValueFromView(view, selectValue.PropertyID, selectValue.ID, timestamp)
		if changed {
			updatedViews = append(updatedViews, nextView)
		}
	}
	return store.UpsertWorkspaceDocumentBatch(ctx, workspacestore.WorkspaceDocumentBatch{
		SelectValues:   []workspacestore.SelectValueDocument{selectValue},
		PropertyValues: updatedPropertyValues,
		Views:          updatedViews,
	})
}

func removePropertyFromView(view workspacestore.ViewDocument, propertyID string, timestamp string) (workspacestore.ViewDocument, bool) {
	nextView := view
	changed := false

	visiblePropertyIDs := removeString(nextView.VisiblePropertyIDs, propertyID)
	if len(visiblePropertyIDs) != len(nextView.VisiblePropertyIDs) {
		nextView.VisiblePropertyIDs = visiblePropertyIDs
		changed = true
	}

	hiddenPropertyIDs := removeString(nextView.HiddenPropertyIDs, propertyID)
	if len(hiddenPropertyIDs) != len(nextView.HiddenPropertyIDs) {
		nextView.HiddenPropertyIDs = hiddenPropertyIDs
		changed = true
	}

	if nextView.PropertyOrder != nil {
		if _, ok := nextView.PropertyOrder[propertyID]; ok {
			propertyOrder := make(map[string]int, len(nextView.PropertyOrder))
			for key, value := range nextView.PropertyOrder {
				if key != propertyID {
					propertyOrder[key] = value
				}
			}
			nextView.PropertyOrder = propertyOrder
			changed = true
		}
	}

	if nextView.ValueVisibility != nil {
		if _, ok := nextView.ValueVisibility[propertyID]; ok {
			valueVisibility := make(map[string]workspacestore.ValueVisibilityDocument, len(nextView.ValueVisibility))
			for key, value := range nextView.ValueVisibility {
				if key != propertyID {
					valueVisibility[key] = value
				}
			}
			nextView.ValueVisibility = valueVisibility
			changed = true
		}
	}

	if nextView.PropertyLayout != nil {
		if _, ok := nextView.PropertyLayout[propertyID]; ok {
			propertyLayout := make(map[string]workspacestore.PropertyLayoutDocument, len(nextView.PropertyLayout))
			for key, value := range nextView.PropertyLayout {
				if key != propertyID {
					propertyLayout[key] = value
				}
			}
			nextView.PropertyLayout = propertyLayout
			changed = true
		}
	}

	if changed {
		nextView.UpdatedAt = timestamp
	}
	return nextView, changed
}

func removeSelectValueFromView(view workspacestore.ViewDocument, propertyID string, selectValueID string, timestamp string) (workspacestore.ViewDocument, bool) {
	if view.ValueVisibility == nil {
		return view, false
	}

	setting, ok := view.ValueVisibility[propertyID]
	if !ok {
		return view, false
	}

	nextValueIDs := removeString(setting.ValueIDs, selectValueID)
	if len(nextValueIDs) == len(setting.ValueIDs) {
		return view, false
	}

	nextView := view
	nextValueVisibility := make(map[string]workspacestore.ValueVisibilityDocument, len(view.ValueVisibility))
	for key, value := range view.ValueVisibility {
		nextValueVisibility[key] = value
	}

	if len(nextValueIDs) == 0 && !setting.IncludeEmpty {
		delete(nextValueVisibility, propertyID)
	} else {
		setting.ValueIDs = nextValueIDs
		nextValueVisibility[propertyID] = setting
	}

	nextView.ValueVisibility = nextValueVisibility
	nextView.UpdatedAt = timestamp
	return nextView, true
}

func removeString(values []string, valueToRemove string) []string {
	if len(values) == 0 {
		return values
	}
	nextValues := make([]string, 0, len(values))
	for _, value := range values {
		if value != valueToRemove {
			nextValues = append(nextValues, value)
		}
	}
	return nextValues
}

func propertyValueUsesSelectValue(value any, selectValueID string) bool {
	if values, ok := value.([]any); ok {
		for _, item := range values {
			if item == selectValueID {
				return true
			}
		}
		return false
	}
	return value == selectValueID
}

func removeSelectValueFromMultiSelect(value any, selectValueID string) []any {
	values, ok := value.([]any)
	if !ok {
		return []any{}
	}
	nextValues := []any{}
	for _, item := range values {
		if item != selectValueID {
			nextValues = append(nextValues, item)
		}
	}
	return nextValues
}

func validateCompleteDocumentOrder[T any](orderedIDs []string, documentsByID map[string]T) error {
	seen := make(map[string]bool, len(orderedIDs))
	for _, id := range orderedIDs {
		trimmedID := strings.TrimSpace(id)
		if trimmedID == "" || seen[trimmedID] {
			return errors.New("ordered ids must include each item once")
		}
		if _, ok := documentsByID[trimmedID]; !ok {
			return errors.New("ordered ids reference an unknown item")
		}
		seen[trimmedID] = true
	}
	if len(seen) != len(documentsByID) {
		return errors.New("ordered ids must include each item once")
	}
	return nil
}

func getPropertyDefinitionType(property workspacestore.PropertyDefinitionDocument) string {
	if property.PropertyType != "" {
		return property.PropertyType
	}
	if property.Type != "propertyDefinition" {
		return property.Type
	}
	return ""
}

func normalizeDocumentID(prefix string, rawID string) string {
	trimmedID := strings.TrimSpace(rawID)
	prefixText := prefix + ":"
	if strings.HasPrefix(trimmedID, prefixText) {
		return prefixText + createSlug(trimmedID[len(prefixText):])
	}
	return prefixText + createSlug(trimmedID)
}

func createStableDocumentID(prefix string, parts ...string) string {
	hash := sha256.Sum256([]byte(strings.Join(parts, "\x00")))
	return fmt.Sprintf("%s:%s", prefix, hex.EncodeToString(hash[:])[:24])
}

func createSlug(value string) string {
	lowerValue := strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	lastWasSeparator := false
	for _, char := range lowerValue {
		isAllowed := (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')
		if isAllowed {
			builder.WriteRune(char)
			lastWasSeparator = false
			continue
		}
		if !lastWasSeparator && builder.Len() > 0 {
			builder.WriteByte('-')
			lastWasSeparator = true
		}
	}
	return strings.Trim(builder.String(), "-")
}

func getStringPayload(payload map[string]any, key string) string {
	if value, ok := payload[key].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}

func getBoolPayload(payload map[string]any, key string) bool {
	value, _ := payload[key].(bool)
	return value
}

func getNumberPayload(payload map[string]any, key string, fallback int) int {
	switch value := payload[key].(type) {
	case float64:
		return int(value)
	case string:
		if number, err := strconv.Atoi(strings.TrimSpace(value)); err == nil {
			return number
		}
	}
	return fallback
}

func createRandomDocumentID(prefix string) (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s:%s", prefix, hex.EncodeToString(bytes)), nil
}

func findPropertyDefinition(ctx context.Context, store *workspacestore.Store, workspaceID string, propertyID string) (workspacestore.PropertyDefinitionDocument, bool, error) {
	if workspaceID == "" || propertyID == "" {
		return workspacestore.PropertyDefinitionDocument{}, false, nil
	}

	properties, err := store.ListPropertyDefinitions(ctx, workspaceID)
	if err != nil {
		return workspacestore.PropertyDefinitionDocument{}, false, err
	}
	for _, property := range properties {
		if property.ID == propertyID {
			return property, true, nil
		}
	}
	return workspacestore.PropertyDefinitionDocument{}, false, nil
}

func applyPropertyPatch(property *workspacestore.PropertyDefinitionDocument, patch map[string]any, updatedAt string) {
	if name, ok := patch["name"].(string); ok {
		property.Name = name
	}
	if hidden, ok := patch["hidden"].(bool); ok {
		property.Hidden = hidden
	}
	if propertyType, ok := patch["type"].(string); ok && property.PropertyType == "" {
		property.PropertyType = propertyType
	}
	if config, ok := patch["config"].(map[string]any); ok {
		property.Config = config
	}
	property.UpdatedAt = updatedAt
}

func findSelectValue(ctx context.Context, store *workspacestore.Store, workspaceID string, selectValueID string) (workspacestore.SelectValueDocument, bool, error) {
	if workspaceID == "" || selectValueID == "" {
		return workspacestore.SelectValueDocument{}, false, nil
	}

	values, err := store.ListSelectValues(ctx, workspaceID, "")
	if err != nil {
		return workspacestore.SelectValueDocument{}, false, err
	}
	for _, value := range values {
		if value.ID == selectValueID {
			return value, true, nil
		}
	}
	return workspacestore.SelectValueDocument{}, false, nil
}

func applySelectValuePatch(value *workspacestore.SelectValueDocument, patch map[string]any, updatedAt string) {
	if name, ok := patch["name"].(string); ok {
		value.Name = name
	}
	if color, ok := patch["color"].(string); ok {
		value.Color = color
	}
	if hidden, ok := patch["hidden"].(bool); ok {
		value.Hidden = hidden
	}
	value.UpdatedAt = updatedAt
}

func writeResult(w http.ResponseWriter, payload any, err error) {
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
