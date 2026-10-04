//go:build darwin && cgo

package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

func TestNativeRenameGuardChild(t *testing.T) {
	encoded := os.Getenv("WORKSPACE_RENAME_GUARD_CHILD")
	if encoded == "" {
		return
	}
	var req renameDirectoryRequest
	if err := json.Unmarshal([]byte(encoded), &req); err != nil {
		os.Exit(9)
	}
	hook := func() { fmt.Println("PINNED"); bufio.NewReader(os.Stdin).ReadString('\n') }
	var beforeCheck, afterCheck func()
	if os.Getenv("WORKSPACE_RENAME_GUARD_AFTER_CHECK") == "1" {
		afterCheck = hook
	} else {
		beforeCheck = hook
	}
	err := renameGuardedProjectDirectoryWithHooks(req, beforeCheck, afterCheck)
	if err == nil {
		fmt.Println("RENAMED")
		os.Exit(0)
	}
	fmt.Println(err)
	os.Exit(2)
}

func TestNativeRenameGuardRejectsMovedParentsAndSourceSubstitution(t *testing.T) {
	for _, kind := range []string{"parent", "root", "replacement", "symlink", "conflict", "late-replacement", "late-symlink", "late-parent", "late-root"} {
		t.Run(kind, func(t *testing.T) {
			dir := t.TempDir()
			root := filepath.Join(dir, "source")
			parent := filepath.Join(root, "Active")
			from := filepath.Join(parent, "Alpha")
			if err := os.MkdirAll(from, 0755); err != nil {
				t.Fatal(err)
			}
			os.WriteFile(filepath.Join(from, "retained.txt"), []byte("retained"), 0644)
			parentInfo, _ := os.Lstat(parent)
			parentStat := parentInfo.Sys().(*syscall.Stat_t)
			info, _ := os.Lstat(from)
			stat := info.Sys().(*syscall.Stat_t)
			req := renameDirectoryRequest{Root: root, Parent: "Active", From: "Alpha", To: "Beta", Dev: uint64(stat.Dev), Ino: stat.Ino, ParentDev: uint64(parentStat.Dev), ParentIno: parentStat.Ino}
			data, _ := json.Marshal(req)
			cmd := exec.Command(os.Args[0], "-test.run=^TestNativeRenameGuardChild$")
			cmd.Env = append(os.Environ(), "WORKSPACE_RENAME_GUARD_CHILD="+string(data))
			stdin, _ := cmd.StdinPipe()
			stdout, _ := cmd.StdoutPipe()
			if strings.HasPrefix(kind, "late-") {
				cmd.Env = append(cmd.Env, "WORKSPACE_RENAME_GUARD_AFTER_CHECK=1")
			}
			if err := cmd.Start(); err != nil {
				t.Fatal(err)
			}
			scanner := bufio.NewScanner(stdout)
			if !scanner.Scan() || scanner.Text() != "PINNED" {
				t.Fatal("child did not pin rename parent")
			}
			retained := from
			switch kind {
			case "parent", "late-parent":
				retained = filepath.Join(dir, "escaped", "Alpha")
				if err := os.Rename(parent, filepath.Join(dir, "escaped")); err != nil {
					t.Fatal(err)
				}
			case "root", "late-root":
				retained = filepath.Join(dir, "escaped-root", "Active", "Alpha")
				if err := os.Rename(root, filepath.Join(dir, "escaped-root")); err != nil {
					t.Fatal(err)
				}
			case "replacement", "late-replacement":
				retained = from + "-original"
				os.Rename(from, retained)
				os.Mkdir(from, 0755)
			case "symlink", "late-symlink":
				retained = from + "-original"
				os.Rename(from, retained)
				os.Symlink(dir, from)
			case "conflict":
				os.Mkdir(filepath.Join(parent, "Beta"), 0755)
				os.WriteFile(filepath.Join(parent, "Beta", "foreign"), []byte("untouched"), 0644)
			}
			stdin.Write([]byte("continue\n"))
			stdin.Close()
			for scanner.Scan() {
				t.Log(scanner.Text())
			}
			if cmd.Wait() == nil {
				t.Fatal("unsafe rename succeeded")
			}
			content, err := os.ReadFile(filepath.Join(retained, "retained.txt"))
			if err != nil || string(content) != "retained" {
				t.Fatal("source contents lost")
			}
			if kind == "parent" || kind == "root" || kind == "late-parent" || kind == "late-root" {
				if _, err := os.Stat(filepath.Join(filepath.Dir(retained), "Beta")); !os.IsNotExist(err) {
					t.Fatal("rename wrote outside lexical source")
				}
			}
			if kind == "conflict" {
				content, _ := os.ReadFile(filepath.Join(parent, "Beta", "foreign"))
				if string(content) != "untouched" {
					t.Fatal("foreign target changed")
				}
			}
		})
	}
}
