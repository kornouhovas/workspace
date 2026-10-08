//go:build (!darwin || !cgo) && !windows

package main

import "fmt"

func renameGuardedProjectDirectory(req renameDirectoryRequest) error {
	return fmt.Errorf("%w: this build has no guarded exclusive project rename implementation", errCreationGuardUnavailable)
}
