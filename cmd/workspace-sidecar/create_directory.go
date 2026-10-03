package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unicode"
)

type directoryRequest struct {
	Root   string `json:"root"`
	Parent string `json:"parent"`
	Name   string `json:"name"`
}

// Root holds directory handles. Production CLI additionally applies the OS
// creation guard before opening the source; handles alone permit moved parents.
func createProjectDirectory(req directoryRequest, beforeMkdir func()) error {
	if req.Name == "" || strings.TrimSpace(req.Name) != req.Name || strings.HasPrefix(req.Name, ".") || strings.ContainsAny(req.Name, "/\\\x00") || strings.IndexFunc(req.Name, unicode.IsControl) >= 0 {
		return errors.New("invalid project name")
	}
	if !filepath.IsAbs(req.Root) {
		return errors.New("source must be absolute")
	}
	info, err := os.Lstat(req.Root)
	if err != nil {
		return err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return errors.New("source must be a real directory")
	}
	current, err := os.OpenRoot(req.Root)
	if err != nil {
		return err
	}
	defer func() { current.Close() }()
	pinned, err := current.Stat(".")
	if err != nil {
		return err
	}
	if !os.SameFile(info, pinned) {
		return errors.New("source changed")
	}
	if req.Parent != "" {
		for _, part := range strings.Split(req.Parent, "/") {
			if part == "" || part == "." || part == ".." || strings.ContainsAny(part, "\\\x00") {
				return errors.New("invalid parent locator")
			}
			info, err := current.Lstat(part)
			if err != nil {
				return err
			}
			if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
				return errors.New("parent must not be a symlink")
			}
			next, err := current.OpenRoot(part)
			if err != nil {
				return err
			}
			pinned, err := next.Stat(".")
			if err != nil {
				next.Close()
				return err
			}
			if !os.SameFile(info, pinned) {
				next.Close()
				return errors.New("parent changed")
			}
			current.Close()
			current = next
		}
	}
	if beforeMkdir != nil {
		beforeMkdir()
	}
	return current.Mkdir(req.Name, 0755)
}

func runCreateDirectory() {
	var req directoryRequest
	err := json.NewDecoder(os.Stdin).Decode(&req)
	if err == nil {
		err = guardProjectCreation(req.Root)
	}
	if err == nil {
		err = createProjectDirectory(req, nil)
	}
	if err != nil {
		code := "CREATE_DIRECTORY_FAILED"
		if errors.Is(err, errCreationGuardUnavailable) {
			code = "PROJECT_CREATE_GUARD_UNAVAILABLE"
		} else if errors.Is(err, os.ErrExist) {
			code = "PROJECT_NAME_CONFLICT"
		}
		json.NewEncoder(os.Stdout).Encode(map[string]any{"error": err.Error(), "code": code})
		os.Exit(1)
	}
	fmt.Println(`{"created":true}`)
}
