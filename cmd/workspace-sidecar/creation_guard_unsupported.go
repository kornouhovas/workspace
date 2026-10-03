//go:build !darwin || !cgo

package main

import (
	"errors"
	"runtime"
)

func applyCreationGuard(string) error {
	if runtime.GOOS == "linux" {
		return errors.New("Linux project creation is unavailable: strict source-rename containment requires an OS mechanism not yet implemented (workspace-ub5)")
	}
	return errors.New("this build has no enforceable project creation sandbox")
}
