package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"unicode"
)

var errCreationGuardUnavailable = errors.New("project creation OS guard unavailable")

func creationGuardProfile(root string) (string, error) {
	if !filepath.IsAbs(root) || strings.IndexFunc(root, unicode.IsControl) >= 0 {
		return "", errors.New("invalid guard source")
	}
	info, err := os.Lstat(root)
	if err != nil {
		return "", err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return "", errors.New("guard source must be a real directory")
	}
	canonical, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	if strings.IndexFunc(canonical, unicode.IsControl) >= 0 {
		return "", errors.New("invalid canonical guard source")
	}
	// SBPL strings share these quoted escapes. Controls are rejected above, and
	// the path is never interpolated as an expression or regular expression.
	return `(version 1) (allow default) (deny file-write*) (allow file-write* (subpath ` + strconv.Quote(canonical) + `))`, nil
}

// This irreversible per-process guard belongs only in the short-lived CLI.
// Root handles prevent symlink redirection; the OS policy additionally denies
// writes when an external process moves the held directory outside the source.
func guardProjectCreation(root string) error {
	profile, err := creationGuardProfile(root)
	if err != nil {
		return err
	}
	if err := applyCreationGuard(profile); err != nil {
		return fmt.Errorf("%w: %v", errCreationGuardUnavailable, err)
	}
	return nil
}
