package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCreateProjectDirectory(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "Active"), 0700); err != nil {
		t.Fatal(err)
	}
	req := directoryRequest{Root: root, Parent: "Active", Name: "Alpha"}
	if err := createProjectDirectory(req, nil); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(filepath.Join(root, "Active", "Alpha"))
	if err != nil || len(entries) != 0 {
		t.Fatalf("expected empty project: %v", err)
	}
	if err := createProjectDirectory(req, nil); err == nil {
		t.Fatal("existing folder must conflict")
	}
	for _, name := range []string{"", ".hidden", "..", "a/b", "a\\b", "bad\x00", " a", "a "} {
		req.Name = name
		if err := createProjectDirectory(req, nil); err == nil {
			t.Fatalf("accepted invalid name %q", name)
		}
	}
	req.Name = "New"
	req.Parent = "../outside"
	if err := createProjectDirectory(req, nil); err == nil {
		t.Fatal("traversal accepted")
	}
}

func TestCreateProjectDirectoryRejectsSymlinkAndPinsDestination(t *testing.T) {
	root, outside := t.TempDir(), t.TempDir()
	os.Mkdir(filepath.Join(root, "Active"), 0700)
	os.Symlink(outside, filepath.Join(root, "Link"))
	if err := createProjectDirectory(directoryRequest{Root: root, Parent: "Link", Name: "Escape"}, nil); err == nil {
		t.Fatal("symlink accepted")
	}
	err := createProjectDirectory(directoryRequest{Root: root, Parent: "Active", Name: "Pinned"}, func() {
		if err := os.Rename(filepath.Join(root, "Active"), filepath.Join(root, "Held")); err != nil {
			t.Fatal(err)
		}
		if err := os.Symlink(outside, filepath.Join(root, "Active")); err != nil {
			t.Fatal(err)
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "Held", "Pinned")); err != nil {
		t.Fatal("creation did not use pinned handle", err)
	}
	if _, err := os.Stat(filepath.Join(outside, "Pinned")); !os.IsNotExist(err) {
		t.Fatal("escaped through replacement symlink")
	}
}
