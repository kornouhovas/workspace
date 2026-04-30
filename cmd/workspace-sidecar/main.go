package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"net"
	"net/http"

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
