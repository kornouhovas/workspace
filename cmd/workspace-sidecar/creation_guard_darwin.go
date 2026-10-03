//go:build darwin && cgo

package main

/*
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <dlfcn.h>
// The deprecated macOS API is resolved at runtime: absence or refusal is a
// hard failure. No environment/renderer marker can bypass policy application.
static char *workspace_guard(const char *profile) {
 void *lib = dlopen("/usr/lib/libsandbox.dylib", RTLD_NOW | RTLD_LOCAL);
 if (!lib) return strdup("macOS sandbox library unavailable");
 typedef int (*init_fn)(const char *, uint64_t, char **);
 typedef void (*free_fn)(char *);
 init_fn init = (init_fn)dlsym(lib, "sandbox_init");
 free_fn release = (free_fn)dlsym(lib, "sandbox_free_error");
 if (!init || !release) { dlclose(lib); return strdup("macOS sandbox API unavailable"); }
 char *detail = NULL;
 int result = init(profile, 0, &detail);
 char *error = result == 0 ? NULL : strdup(detail ? detail : "macOS sandbox policy rejected");
 if (detail) release(detail);
 dlclose(lib);
 return error;
}
*/
import "C"
import (
	"errors"
	"unsafe"
)

func applyCreationGuard(profile string) error {
	value := C.CString(profile)
	defer C.free(unsafe.Pointer(value))
	detail := C.workspace_guard(value)
	if detail == nil {
		return nil
	}
	defer C.free(unsafe.Pointer(detail))
	return errors.New(C.GoString(detail))
}
