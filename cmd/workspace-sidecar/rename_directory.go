package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type renameDirectoryRequest struct {
	ParentDev uint64 `json:"parentDev"`
	ParentIno uint64 `json:"parentIno"`
	Root      string `json:"root"`
	Parent    string `json:"parent"`
	From      string `json:"from"`
	To        string `json:"to"`
	Dev       uint64 `json:"dev"`
	Ino       uint64 `json:"ino"`
}

func validateRenameRequest(req renameDirectoryRequest) error {
	if !filepath.IsAbs(req.Root) || req.From == "" || req.To == "" || req.From == req.To || strings.ContainsAny(req.From+req.To, "/\\\x00") || req.From == "." || req.From == ".." || req.To == "." || req.To == ".." {
		return errors.New("invalid rename locator")
	}
	// Internal staging names are supplied by the backend, never the renderer.
	if !strings.HasPrefix(req.To, ".workspace-rename-") && !validProjectName(req.To, runtime.GOOS) {
		return errors.New("invalid project name")
	}
	for _, part := range strings.Split(req.Parent, "/") {
		if req.Parent != "" && (part == "" || part == "." || part == ".." || strings.ContainsAny(part, "\\\x00")) {
			return errors.New("invalid parent locator")
		}
	}
	return nil
}

func runRenameDirectory() {
	var req renameDirectoryRequest
	err := json.NewDecoder(os.Stdin).Decode(&req)
	if err == nil {
		err = validateRenameRequest(req)
	}
	if err == nil {
		err = renameGuardedProjectDirectory(req)
	}
	if err != nil {
		code := "PROJECT_RENAME_FAILED"
		if errors.Is(err, errCreationGuardUnavailable) {
			code = "PROJECT_RENAME_GUARD_UNAVAILABLE"
		} else if errors.Is(err, os.ErrExist) {
			code = "PROJECT_NAME_CONFLICT"
		}
		json.NewEncoder(os.Stdout).Encode(map[string]any{"error": err.Error(), "code": code})
		os.Exit(1)
	}
	fmt.Println(`{"renamed":true}`)
}
