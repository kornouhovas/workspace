package main

import "testing"

func TestRenameDirectoryValidation(t *testing.T) {
	for _, req := range []renameDirectoryRequest{
		{Root: "relative", From: "Alpha", To: "Beta"},
		{Root: "/tmp", From: "../Alpha", To: "Beta"},
		{Root: "/tmp", From: "Alpha", To: "../Beta"},
		{Root: "/tmp", Parent: "../outside", From: "Alpha", To: "Beta"},
		{Root: "/tmp", From: "Alpha", To: "Alpha"},
	} {
		if validateRenameRequest(req) == nil {
			t.Errorf("accepted unsafe request: %+v", req)
		}
	}
}
