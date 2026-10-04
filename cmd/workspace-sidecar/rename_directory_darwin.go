//go:build darwin && cgo

package main

/*
#include <sys/stat.h>
#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
static int workspace_rename_parent(const char *root, const char *parent) {
 int fd = open(root, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
 if (fd < 0) return -errno;
 char *parts = strdup(parent), *save = NULL;
 for(char *part = strtok_r(parts,"/",&save); part; part = strtok_r(NULL,"/",&save)) {
  int next = openat(fd,part,O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
  if(next < 0) {int e=errno; close(fd);free(parts);return -e;}
  close(fd);fd=next;
 }
 free(parts);
 return fd;
}
static int workspace_rename_verify(int fd, const char *from, uint64_t dev, uint64_t ino, uint64_t parentDev, uint64_t parentIno) {
 struct stat s;
 if(fstat(fd,&s) != 0) return errno;
 if((uint64_t)s.st_dev != parentDev || (uint64_t)s.st_ino != parentIno) return ESTALE;
 if(fstatat(fd,from,&s,AT_SYMLINK_NOFOLLOW) != 0) return errno;
 if(!S_ISDIR(s.st_mode) || (uint64_t)s.st_dev != dev || (uint64_t)s.st_ino != ino) return ESTALE;
 return 0;
}
static int workspace_rename_fd(int fd, const char *from, const char *to, uint64_t dev, uint64_t ino) {
 // RENAME_EXCL is enforced in the same native syscall, including empty targets.
 if(renameatx_np(fd,from,fd,to,RENAME_EXCL) != 0) return errno;
 struct stat s;
 if(fstatat(fd,to,&s,AT_SYMLINK_NOFOLLOW) != 0) return errno;
 if(!S_ISDIR(s.st_mode) || (uint64_t)s.st_dev != dev || (uint64_t)s.st_ino != ino) return ESTALE;
 return 0;
}
*/
import "C"
import (
	"os"
	"path/filepath"
	"syscall"
	"unsafe"
)

func renameGuardedProjectDirectory(req renameDirectoryRequest) error {
	return renameGuardedProjectDirectoryWithHooks(req, nil, nil)
}

func renameGuardedProjectDirectoryWithHooks(req renameDirectoryRequest, beforeCheck, afterCheck func()) error {
	if err := guardProjectCreation(req.Root); err != nil {
		return err
	}
	canonical, err := filepath.EvalSymlinks(req.Root)
	if err != nil {
		return err
	}
	root, parent, from, to := C.CString(canonical), C.CString(req.Parent), C.CString(req.From), C.CString(req.To)
	defer C.free(unsafe.Pointer(root))
	defer C.free(unsafe.Pointer(parent))
	defer C.free(unsafe.Pointer(from))
	defer C.free(unsafe.Pointer(to))
	fd := C.workspace_rename_parent(root, parent)
	if fd < 0 {
		return &os.PathError{Op: "open rename parent", Path: req.Parent, Err: syscall.Errno(-fd)}
	}
	defer C.close(fd)
	if beforeCheck != nil {
		beforeCheck()
	}
	code := C.workspace_rename_verify(fd, from, C.uint64_t(req.Dev), C.uint64_t(req.Ino), C.uint64_t(req.ParentDev), C.uint64_t(req.ParentIno))
	if code != 0 {
		return &os.PathError{Op: "verify rename identity", Path: req.From, Err: syscall.Errno(code)}
	}
	// Hooks are internal Go test functions; no CLI/renderer payload enables them.
	if afterCheck != nil {
		afterCheck()
	}
	code = C.workspace_rename_fd(fd, from, to, C.uint64_t(req.Dev), C.uint64_t(req.Ino))
	if code != 0 {
		return &os.PathError{Op: "exclusive rename", Path: req.From, Err: syscall.Errno(code)}
	}
	return nil
}
