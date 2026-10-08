//go:build windows

package main

import (
	"errors"
	"fmt"
	"golang.org/x/sys/windows"
	"os"
	"path/filepath"
	"strings"
	"unsafe"
)

func renameGuardedProjectDirectory(req renameDirectoryRequest) error {
	if !validProjectName(req.To, "windows") && !strings.HasPrefix(req.To, ".workspace-rename-") {
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
	var parentInfo windows.ByHandleFileInformation
	if err := windows.GetFileInformationByHandle(h, &parentInfo); err != nil {
		return err
	}
	if uint64(parentInfo.VolumeSerialNumber) != req.ParentDev || uint64(parentInfo.FileIndexHigh)<<32|uint64(parentInfo.FileIndexLow) != req.ParentIno {
		return errors.New("project parent identity changed")
	}
	value, err := windows.NewNTUnicodeString(req.From)
	if err != nil {
		return err
	}
	oa := windows.OBJECT_ATTRIBUTES{RootDirectory: h, ObjectName: value, Attributes: windows.OBJ_DONT_REPARSE}
	oa.Length = uint32(unsafe.Sizeof(oa))
	var source windows.Handle
	var iosb windows.IO_STATUS_BLOCK
	err = windows.NtCreateFile(&source, windows.DELETE|windows.FILE_LIST_DIRECTORY|windows.FILE_READ_ATTRIBUTES|windows.SYNCHRONIZE, &oa, &iosb, nil, 0, windows.FILE_SHARE_READ, windows.FILE_OPEN, windows.FILE_DIRECTORY_FILE|windows.FILE_OPEN_REPARSE_POINT|windows.FILE_SYNCHRONOUS_IO_NONALERT, 0, 0)
	if err != nil {
		return err
	}
	defer windows.CloseHandle(source)
	if err := rejectCreationReparse(source); err != nil {
		return err
	}
	var info windows.ByHandleFileInformation
	if err := windows.GetFileInformationByHandle(source, &info); err != nil {
		return err
	}
	if uint64(info.VolumeSerialNumber) != req.Dev || uint64(info.FileIndexHigh)<<32|uint64(info.FileIndexLow) != req.Ino {
		return errors.New("project folder identity changed")
	}
	name, err := windows.UTF16FromString(req.To)
	if err != nil {
		return err
	}
	type renameInfo struct {
		Replace uint32
		Root    windows.Handle
		Length  uint32
		Name    [1]uint16
	}
	var shape renameInfo
	size := int(unsafe.Offsetof(shape.Name)) + (len(name)-1)*2
	buffer := make([]byte, size)
	data := (*renameInfo)(unsafe.Pointer(&buffer[0]))
	data.Root = h
	data.Length = uint32((len(name) - 1) * 2)
	// Replace remains zero: the native operation never overwrites a destination.
	copy(unsafe.Slice(&data.Name[0], len(name)-1), name[:len(name)-1])
	err = windows.NtSetInformationFile(source, &iosb, &buffer[0], uint32(size), windows.FileRenameInformation)
	if err == windows.STATUS_OBJECT_NAME_COLLISION {
		return os.ErrExist
	}
	return err
}
