//go:build !darwin || !cgo

package main

import "errors"

func applyCreationGuard(string) error {
	return errors.New("this build has no enforceable project creation sandbox")
}
