package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"net"
	"net/http"
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
