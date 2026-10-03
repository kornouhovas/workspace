//go:build windows

package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Windows share reservations are enforced against every process by NTFS.
// Holding EVERY ancestor without share-write/share-delete prevents renaming
// the source or moving a status. FILE_LIST_DIRECTORY engages sharing checks.
// Reparse redirection is excluded separately by handle-relative single-component
// lookup with OBJ_DONT_REPARSE and FILE_OPEN_REPARSE_POINT.
// An already-open conflicting write/delete handle makes acquisition fail.
// Attribute-only handles may still set a reparse tag; sharing is not a claim
// that all such mutations are blocked. Retained directory objects and no-reparse
// lookup prevent following them outside the source.
// Each lookup is a single component relative to the preceding locked handle.
func createGuardedProjectDirectory(req directoryRequest, beforeMkdir func()) error {
	if !validProjectName(req.Name, "windows") {
		return errors.New("invalid project name")
	}
	root := filepath.Clean(req.Root)
	volume := filepath.VolumeName(root)
	if !filepath.IsAbs(root) || len(volume) != 2 || volume[1] != ':' || strings.ContainsAny(root, "\x00") || strings.HasPrefix(root, `\\`) {
		return fmt.Errorf("%w: Windows requires a local absolute drive path", errCreationGuardUnavailable)
	}
	components := []string{}
	suffix := strings.TrimPrefix(root, volume+`\`)
	if suffix != "" {
		components = append(components, strings.Split(suffix, `\`)...)
	}
	if req.Parent != "" {
		components = append(components, strings.Split(req.Parent, "/")...)
	}
	for _, part := range components {
		if !validWindowsPathComponent(part) {
			return errors.New("invalid source or parent component")
		}
	}
	drive, err := windows.UTF16PtrFromString(volume + `\`)
	if err != nil {
		return err
	}
	if windows.GetDriveType(drive) != windows.DRIVE_FIXED {
		return fmt.Errorf("%w: only local fixed NTFS volumes are supported", errCreationGuardUnavailable)
	}
	h, err := windows.CreateFile(drive, windows.FILE_LIST_DIRECTORY|windows.FILE_READ_ATTRIBUTES|windows.FILE_TRAVERSE|windows.SYNCHRONIZE, windows.FILE_SHARE_READ, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS|windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
	if err != nil {
		return fmt.Errorf("%w: cannot reserve volume ancestry: %v", errCreationGuardUnavailable, err)
	}
	held := []windows.Handle{h}
	defer func() {
		for i := len(held) - 1; i >= 0; i-- {
			windows.CloseHandle(held[i])
		}
	}()
	if err := validateCreationVolume(h, drive); err != nil {
		return fmt.Errorf("%w: %v", errCreationGuardUnavailable, err)
	}
	for _, part := range components {
		next, err := openCreationComponent(h, part, windows.FILE_OPEN)
		if err != nil {
			return fmt.Errorf("%w: cannot reserve source ancestry: %v", errCreationGuardUnavailable, err)
		}
		held = append(held, next)
		if err := rejectCreationReparse(next); err != nil {
			return err
		}
		h = next
	}
	if beforeMkdir != nil {
		beforeMkdir()
	}
	created, err := openCreationComponent(h, req.Name, windows.FILE_CREATE)
	if err != nil {
		return err
	}
	return windows.CloseHandle(created)
}

func openCreationComponent(parent windows.Handle, name string, disposition uint32) (windows.Handle, error) {
	value, err := windows.NewNTUnicodeString(name)
	if err != nil {
		return 0, err
	}
	oa := windows.OBJECT_ATTRIBUTES{RootDirectory: parent, ObjectName: value, Attributes: windows.OBJ_DONT_REPARSE}
	// Preserve the exact source locator on case-sensitive NTFS directories.
	if disposition == windows.FILE_CREATE {
		oa.Attributes |= windows.OBJ_CASE_INSENSITIVE
	}
	oa.Length = uint32(unsafe.Sizeof(oa))
	var h windows.Handle
	var status windows.IO_STATUS_BLOCK
	err = windows.NtCreateFile(&h, windows.FILE_LIST_DIRECTORY|windows.FILE_READ_ATTRIBUTES|windows.FILE_TRAVERSE|windows.SYNCHRONIZE, &oa, &status, nil, windows.FILE_ATTRIBUTE_DIRECTORY, windows.FILE_SHARE_READ, disposition, windows.FILE_DIRECTORY_FILE|windows.FILE_OPEN_REPARSE_POINT|windows.FILE_SYNCHRONOUS_IO_NONALERT, 0, 0)
	if err == windows.STATUS_OBJECT_NAME_COLLISION {
		return 0, os.ErrExist
	}
	if err != nil {
		return 0, err
	}
	return h, nil
}

func rejectCreationReparse(h windows.Handle) error {
	var info windows.ByHandleFileInformation
	if err := windows.GetFileInformationByHandle(h, &info); err != nil {
		return err
	}
	if info.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 || info.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY == 0 {
		return errors.New("source ancestry must be real directories without reparse points")
	}
	return nil
}

func validateCreationVolume(h windows.Handle, drive *uint16) error {
	if err := rejectCreationReparse(h); err != nil {
		return err
	}
	var filesystem [64]uint16
	if err := windows.GetVolumeInformationByHandle(h, nil, 0, nil, nil, nil, &filesystem[0], uint32(len(filesystem))); err != nil {
		return err
	}
	if windows.UTF16ToString(filesystem[:]) != "NTFS" {
		return errors.New("only NTFS supports this creation guard configuration")
	}
	// Reject SUBST/mapped drive roots: opening C:\ must be the actual volume root.
	var expected, actual [1024]uint16
	if err := windows.GetVolumeNameForVolumeMountPoint(drive, &expected[0], uint32(len(expected))); err != nil {
		return err
	}
	n, err := windows.GetFinalPathNameByHandle(h, &actual[0], uint32(len(actual)), 1 /* VOLUME_NAME_GUID */)
	if err != nil {
		return err
	}
	if n == 0 || n >= uint32(len(actual)) || !strings.EqualFold(windows.UTF16ToString(expected[:]), windows.UTF16ToString(actual[:])) {
		return errors.New("mapped drive roots are unsupported")
	}
	return nil
}

func validWindowsPathComponent(name string) bool {
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, "/\\\x00") || strings.HasSuffix(name, " ") {
		return false
	}
	// Existing hidden/leading-space ancestors are valid. Only a newly created
	// project name is required to be visible with no surrounding whitespace.
	return validProjectName("x"+name, "windows")
}
