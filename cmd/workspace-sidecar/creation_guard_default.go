//go:build !windows

package main

func createGuardedProjectDirectory(req directoryRequest, beforeMkdir func()) error {
	if err := guardProjectCreation(req.Root); err != nil {
		return err
	}
	return createProjectDirectory(req, beforeMkdir)
}
