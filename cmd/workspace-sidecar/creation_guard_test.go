package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestCreationGuardChild(t *testing.T) {
	raw := os.Getenv("WORKSPACE_GUARD_TEST_REQUEST")
	if raw == "" {
		return
	}
	var req directoryRequest
	if json.Unmarshal([]byte(raw), &req) != nil {
		os.Exit(9)
	}
	mode := os.Getenv("WORKSPACE_GUARD_TEST_MODE")
	if mode == "malformed" {
		if applyCreationGuard("(invalid profile") == nil {
			os.Exit(9)
		}
		os.Exit(0)
	}
	if mode == "preexisting" {
		if err := applyCreationGuard(`(version 1) (allow default)`); err != nil {
			os.Exit(9)
		}
	}
	if err := guardProjectCreation(req.Root); err != nil {
		fmt.Println("GUARD", err)
		if mode == "preexisting" {
			os.Exit(0)
		}
		os.Exit(8)
	}
	if mode == "preexisting" {
		if err := os.Mkdir(filepath.Join(filepath.Dir(req.Root), "Escape"), 0700); err == nil {
			os.Exit(9)
		}
		os.Exit(0)
	}
	err := createProjectDirectory(req, func() { fmt.Println("READY"); bufio.NewReader(os.Stdin).ReadString('\n') })
	if err != nil {
		fmt.Println("DENIED", err)
		os.Exit(3)
	}
	fmt.Println("CREATED")
	os.Exit(0)
}

func guardChild(t *testing.T, req directoryRequest, mode string, before func()) (string, error) {
	t.Helper()
	raw, _ := json.Marshal(req)
	cmd := exec.Command(os.Args[0], "-test.run=^TestCreationGuardChild$")
	cmd.Env = append(os.Environ(), "WORKSPACE_GUARD_TEST_REQUEST="+string(raw), "WORKSPACE_GUARD_TEST_MODE="+mode)
	stdin, _ := cmd.StdinPipe()
	stdout, _ := cmd.StdoutPipe()
	var stderr strings.Builder
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	reader := bufio.NewReader(stdout)
	line, _ := reader.ReadString('\n')
	if strings.TrimSpace(line) == "READY" {
		if before != nil {
			before()
		}
		fmt.Fprintln(stdin, "GO")
		rest, _ := reader.ReadString('\n')
		line += rest
	}
	stdin.Close()
	err := cmd.Wait()
	return line + stderr.String(), err
}

func TestCreationGuardProfile(t *testing.T) {
	root := filepath.Join(t.TempDir(), `source "quoted" \ unicode Ж`)
	os.Mkdir(root, 0700)
	profile, err := creationGuardProfile(root)
	if err != nil || !strings.Contains(profile, `\"quoted\"`) || !strings.Contains(profile, `\\`) {
		t.Fatalf("escaped literal: %s %v", profile, err)
	}
	for _, bad := range []string{"relative", root + "\n", filepath.Join(root, "absent")} {
		if _, err := creationGuardProfile(bad); err == nil {
			t.Fatalf("accepted %q", bad)
		}
	}
	link := filepath.Join(t.TempDir(), "link")
	os.Symlink(root, link)
	if _, err := creationGuardProfile(link); err == nil {
		t.Fatal("symlink source accepted")
	}
}

func TestCreateProjectDirectoryParentMovedOutsideSource(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS OS enforcement")
	}
	for _, ancestor := range []string{"status", "source"} {
		t.Run(ancestor, func(t *testing.T) {
			root, outside := t.TempDir(), t.TempDir()
			status := filepath.Join(root, "Active")
			os.Mkdir(status, 0700)
			moved := filepath.Join(outside, "Moved")
			destination := filepath.Join(moved, "UnexpectedOutside")
			from := status
			if ancestor == "source" {
				from = root
				destination = filepath.Join(moved, "Active", "UnexpectedOutside")
			}
			output, err := guardChild(t, directoryRequest{Root: root, Parent: "Active", Name: "UnexpectedOutside"}, "", func() {
				if err := os.Rename(from, moved); err != nil {
					t.Fatal(err)
				}
			})
			if err == nil || !strings.Contains(output, "operation not permitted") {
				t.Fatalf("expected OS denial: %s %v", output, err)
			}
			if _, err := os.Stat(destination); !os.IsNotExist(err) {
				t.Fatalf("outside write: %v", err)
			}
		})
	}
}

func TestCreationGuardAllowedEscapedSourceAndConflict(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS OS enforcement")
	}
	root := filepath.Join(t.TempDir(), `source "quoted" \ Ж`)
	os.Mkdir(root, 0700)
	os.Mkdir(filepath.Join(root, "Active"), 0700)
	req := directoryRequest{Root: root, Parent: "Active", Name: "Allowed"}
	output, err := guardChild(t, req, "", nil)
	if err != nil {
		t.Fatalf("normal creation: %s %v", output, err)
	}
	output, err = guardChild(t, req, "", nil)
	if err == nil || !strings.Contains(output, "file exists") {
		t.Fatalf("conflict: %s %v", output, err)
	}
	entries, _ := os.ReadDir(filepath.Join(root, "Active", "Allowed"))
	if len(entries) != 0 {
		t.Fatal("project not empty")
	}
	for _, mode := range []string{"malformed", "preexisting"} {
		output, err = guardChild(t, req, mode, nil)
		if err != nil {
			t.Fatalf("%s failure: %s %v", mode, output, err)
		}
	}
}
