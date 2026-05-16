package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
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

		var value workspacestore.PropertyValueDocument
		if err := json.NewDecoder(r.Body).Decode(&value); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		writeResult(w, map[string]any{"ok": true}, store.UpsertPropertyValue(r.Context(), value))
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

		timestamp := time.Now().UTC().Format(time.RFC3339Nano)
		reordered := make([]workspacestore.PropertyDefinitionDocument, 0, len(payload.OrderedPropertyIDs))
		for index, propertyID := range payload.OrderedPropertyIDs {
			property, ok := propertiesByID[propertyID]
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "property was not found"})
				return
			}
			property.Order = (index + 1) * 10
			property.UpdatedAt = timestamp
			if err := store.UpsertPropertyDefinition(r.Context(), property); err != nil {
				writeResult(w, nil, err)
				return
			}
			reordered = append(reordered, property)
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
				WorkspaceID string `json:"workspaceId"`
				PropertyID  string `json:"propertyId"`
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
			writeResult(w, map[string]any{"ok": true}, store.UpsertPropertyDefinition(r.Context(), property))
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

		timestamp := time.Now().UTC().Format(time.RFC3339Nano)
		reordered := make([]workspacestore.SelectValueDocument, 0, len(payload.OrderedSelectValueIDs))
		for index, valueID := range payload.OrderedSelectValueIDs {
			value, ok := valuesByID[valueID]
			if !ok {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "select value was not found"})
				return
			}
			value.Order = (index + 1) * 10
			value.UpdatedAt = timestamp
			if err := store.UpsertSelectValue(r.Context(), value); err != nil {
				writeResult(w, nil, err)
				return
			}
			reordered = append(reordered, value)
		}

		writeJSON(w, http.StatusOK, map[string]any{"selectValues": reordered})
	})
	mux.HandleFunc("/workspace/select-values", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			var value workspacestore.SelectValueDocument
			if err := json.NewDecoder(r.Body).Decode(&value); err != nil {
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
				WorkspaceID   string `json:"workspaceId"`
				SelectValueID string `json:"selectValueId"`
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
			writeResult(w, map[string]any{"ok": true}, store.UpsertSelectValue(r.Context(), value))
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

	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("workspace-sidecar listening on %s", listener.Addr().String())
	log.Fatal(http.Serve(listener, mux))
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
