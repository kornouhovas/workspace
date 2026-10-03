//go:build windows

package main

import (
	"encoding/binary"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/windows"
)

func TestWindowsCreationGuardReservations(t *testing.T) {
	for _, ancestor := range []string{"status", "source", "source-parent"} {
		t.Run(ancestor, func(t *testing.T) {
			base, outside := t.TempDir(), t.TempDir()
			root := filepath.Join(base, "source")
			status := filepath.Join(root, "Active")
			if err := os.MkdirAll(status, 0700); err != nil {
				t.Fatal(err)
			}
			from := status
			if ancestor == "source" {
				from = root
			}
			if ancestor == "source-parent" {
				from = base
			}
			output, err := guardChild(t, directoryRequest{Root: root, Parent: "Active", Name: "Allowed"}, "", func() {
				if err := os.Rename(from, filepath.Join(outside, "Moved")); err == nil {
					t.Fatal("OS allowed reserved ancestor rename")
				}
				path, _ := windows.UTF16PtrFromString(from)
				for _, access := range []uint32{windows.DELETE, windows.GENERIC_WRITE} {
					h, err := windows.CreateFile(path, access, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS, 0)
					if err == nil {
						windows.CloseHandle(h)
						t.Fatal("OS granted conflicting write/delete handle")
					}
				}
			})
			if err != nil {
				t.Fatalf("normal creation with attack attempts: %s %v", output, err)
			}
			if _, err := os.Stat(filepath.Join(status, "Allowed")); err != nil {
				t.Fatal(err)
			}
			if entries, _ := os.ReadDir(outside); len(entries) != 0 {
				t.Fatal("outside write")
			}
			output, err = guardChild(t, directoryRequest{Root: root, Parent: "Active", Name: "Allowed"}, "", nil)
			if err == nil || !strings.Contains(output, "file already exists") {
				t.Fatalf("exclusive conflict: %s %v", output, err)
			}
		})
	}
}

func TestWindowsCreationGuardPreexistingDeleteHandle(t *testing.T) {
	root := filepath.Join(t.TempDir(), "source")
	if err := os.Mkdir(root, 0700); err != nil {
		t.Fatal(err)
	}
	path, _ := windows.UTF16PtrFromString(root)
	h, err := windows.CreateFile(path, windows.DELETE, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer windows.CloseHandle(h)
	output, err := guardChild(t, directoryRequest{Root: root, Name: "Denied"}, "", nil)
	if err == nil || !strings.Contains(output, "guard unavailable") {
		t.Fatalf("expected safe refusal: %s %v", output, err)
	}
	if _, err := os.Stat(filepath.Join(root, "Denied")); !os.IsNotExist(err) {
		t.Fatal("creation despite conflicting handle")
	}
}

func TestWindowsCreationGuardRejectsJunction(t *testing.T) {
	for _, location := range []string{"source", "parent", "ancestor"} {
		t.Run(location, func(t *testing.T) {
			base, outside := t.TempDir(), t.TempDir()
			if err := os.Mkdir(filepath.Join(outside, "Active"), 0700); err != nil {
				t.Fatal(err)
			}
			root := filepath.Join(base, "source")
			link := root
			target := outside
			if location == "parent" {
				if err := os.Mkdir(root, 0700); err != nil {
					t.Fatal(err)
				}
				link = filepath.Join(root, "Active")
				target = filepath.Join(outside, "Active")
			}
			if location == "ancestor" {
				link = filepath.Join(base, "ancestor")
				root = filepath.Join(link, "source")
				if err := os.MkdirAll(filepath.Join(outside, "source", "Active"), 0700); err != nil {
					t.Fatal(err)
				}
			}
			// NTFS junctions require no symlink privilege; invoke cmd only on temp paths.
			cmd := exec.Command("cmd.exe", "/c", "mklink", "/J", link, target)
			if output, err := cmd.CombinedOutput(); err != nil {
				t.Fatalf("junction fixture: %s %v", output, err)
			}
			defer os.Remove(link)
			output, err := guardChild(t, directoryRequest{Root: root, Parent: "Active", Name: "Escape"}, "", nil)
			if err == nil {
				t.Fatalf("junction accepted: %s", output)
			}
			if _, err := os.Stat(filepath.Join(target, "Escape")); !os.IsNotExist(err) {
				t.Fatal("outside write")
			}
			if _, err := os.Stat(filepath.Join(outside, "Active", "Escape")); !os.IsNotExist(err) {
				t.Fatal("outside write")
			}
		})
	}
}

// Attribute-only handles do not engage share-write checks. Exercise this
// separate attack surface on native Windows; never infer protection from sharing.
func TestWindowsCreationGuardHeldDirectoryReparseMutation(t *testing.T) {
	root, outside := t.TempDir(), t.TempDir()
	status := filepath.Join(root, "Active")
	if err := os.Mkdir(status, 0700); err != nil {
		t.Fatal(err)
	}
	var mutationErr error
	var attrs windows.Handle
	output, creationErr := guardChild(t, directoryRequest{Root: root, Parent: "Active", Name: "Confined"}, "", func() {
		path, _ := windows.UTF16PtrFromString(status)
		attrs, mutationErr = windows.CreateFile(path, windows.FILE_WRITE_ATTRIBUTES, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS|windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
		if mutationErr != nil {
			return
		}
		substitute, _ := windows.UTF16FromString(`\??\` + outside)
		printName, _ := windows.UTF16FromString(outside)
		buf := make([]byte, 16+2*(len(substitute)+len(printName)))
		binary.LittleEndian.PutUint32(buf, windows.IO_REPARSE_TAG_MOUNT_POINT)
		binary.LittleEndian.PutUint16(buf[4:], uint16(len(buf)-8))
		binary.LittleEndian.PutUint16(buf[10:], uint16(2*(len(substitute)-1)))
		binary.LittleEndian.PutUint16(buf[12:], uint16(2*len(substitute)))
		binary.LittleEndian.PutUint16(buf[14:], uint16(2*(len(printName)-1)))
		for i, c := range append(substitute, printName...) {
			binary.LittleEndian.PutUint16(buf[16+2*i:], c)
		}
		var returned uint32
		mutationErr = windows.DeviceIoControl(attrs, windows.FSCTL_SET_REPARSE_POINT, &buf[0], uint32(len(buf)), nil, 0, &returned, nil)
	})
	if attrs != 0 && attrs != windows.InvalidHandle {
		defer windows.CloseHandle(attrs)
	}
	if mutationErr != nil {
		t.Skipf("attribute-only reparse mutation unavailable on this OS/ACL: %v", mutationErr)
	}
	if _, err := os.Stat(filepath.Join(outside, "Confined")); !os.IsNotExist(err) {
		t.Fatalf("redirected creation outside source: %v %s", err, output)
	}
	// Remove the tag through the same object to observe the original directory.
	buf := make([]byte, 8)
	binary.LittleEndian.PutUint32(buf, windows.IO_REPARSE_TAG_MOUNT_POINT)
	var returned uint32
	if err := windows.DeviceIoControl(attrs, windows.FSCTL_DELETE_REPARSE_POINT, &buf[0], uint32(len(buf)), nil, 0, &returned, nil); err != nil {
		t.Fatal(err)
	}
	_, err := os.Stat(filepath.Join(status, "Confined"))
	if creationErr == nil && err != nil {
		t.Fatalf("success did not create in original directory: %v %s", err, output)
	}
	if creationErr != nil && !os.IsNotExist(err) {
		t.Fatalf("refusal still created directory: %v %s", err, output)
	}
}
