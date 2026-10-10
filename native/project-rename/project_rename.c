#include <node_api.h>
#include <stdint.h>
#include <stdlib.h>
#ifdef _WIN32
#include <windows.h>
#elif defined(__APPLE__)
#include <stdio.h>
#include <errno.h>
#endif

/* One private, synchronous primitive. All results are finite strings; never
 * return paths, OS messages, errno text or a native exception to JavaScript. */
static napi_value result(napi_env env, const char *code) {
  napi_value value;
  return napi_create_string_utf8(env, code, NAPI_AUTO_LENGTH, &value) == napi_ok ? value : NULL;
}

/* Read UTF-16 first on both platforms so N-API cannot silently replace an
 * unpaired surrogate during UTF-8 conversion. Never coerce JS values. */
static const char *read_path(napi_env env, napi_value value, uint16_t **out) {
  napi_valuetype type;
  size_t length = 0, copied = 0;
  if (napi_typeof(env, value, &type) != napi_ok || type != napi_string ||
      napi_get_value_string_utf16(env, value, NULL, 0, &length) != napi_ok ||
      length == 0 || length > (SIZE_MAX / sizeof(uint16_t)) - 1) return "invalid_argument";
  uint16_t *path = malloc((length + 1) * sizeof(uint16_t));
  if (!path) return "filesystem_error";
  if (napi_get_value_string_utf16(env, value, path, length + 1, &copied) != napi_ok || copied != length) {
    free(path); return "invalid_argument";
  }
  for (size_t i = 0; i < length; i++) {
    uint16_t unit = path[i];
    if (unit == 0 || (unit >= 0xdc00 && unit <= 0xdfff)) { free(path); return "invalid_argument"; }
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (++i >= length || path[i] < 0xdc00 || path[i] > 0xdfff) { free(path); return "invalid_argument"; }
    }
  }
#ifdef _WIN32
  /* Fully qualified drive or UNC paths, including extended-length paths.
   * Reject root-relative/drive-relative paths that depend on process cwd. */
  int drive = length >= 3 && ((path[0] >= 'A' && path[0] <= 'Z') || (path[0] >= 'a' && path[0] <= 'z')) &&
    path[1] == ':' && (path[2] == '\\' || path[2] == '/');
  int unc = length >= 3 && path[0] == '\\' && path[1] == '\\' && path[2] != '\\';
  if (!drive && !unc) { free(path); return "invalid_argument"; }
#else
  if (path[0] != '/') { free(path); return "invalid_argument"; }
#endif
  *out = path;
  return NULL;
}

#if defined(__APPLE__)
static const char *utf8_path(napi_env env, napi_value value, char **out) {
  size_t length = 0, copied = 0;
  if (napi_get_value_string_utf8(env, value, NULL, 0, &length) != napi_ok || length == SIZE_MAX) return "invalid_argument";
  char *path = malloc(length + 1);
  if (!path) return "filesystem_error";
  if (napi_get_value_string_utf8(env, value, path, length + 1, &copied) != napi_ok || copied != length) {
    free(path); return "invalid_argument";
  }
  *out = path;
  return NULL;
}
#endif

static napi_value rename_no_replace(napi_env env, napi_callback_info info) {
  /* Three slots detect extra arguments, including when more than three were
   * supplied. Only exactly two strings are accepted. */
  size_t argc = 3;
  napi_value argv[3];
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 2) return result(env, "invalid_argument");
  uint16_t *from = NULL, *to = NULL;
  const char *code = read_path(env, argv[0], &from);
  if (!code) code = read_path(env, argv[1], &to);
  if (code) { free(from); free(to); return result(env, code); }
#ifdef _WIN32
  /* wchar_t is UTF-16 on Windows. No REPLACE_EXISTING, COPY_ALLOWED or reboot
   * flags: a destination created at the syscall boundary cannot be replaced. */
  if (MoveFileExW((LPCWSTR)from, (LPCWSTR)to, 0)) code = "renamed";
  else {
    DWORD error = GetLastError();
    switch (error) {
      case ERROR_FILE_EXISTS: case ERROR_ALREADY_EXISTS: case ERROR_DIR_NOT_EMPTY: code = "occupied"; break;
      case ERROR_FILE_NOT_FOUND: case ERROR_PATH_NOT_FOUND: case ERROR_DIRECTORY: code = "source_unavailable"; break;
      case ERROR_ACCESS_DENIED: case ERROR_PRIVILEGE_NOT_HELD: case ERROR_WRITE_PROTECT: code = "permission_denied"; break;
      case ERROR_SHARING_VIOLATION: case ERROR_LOCK_VIOLATION: code = "busy"; break;
      case ERROR_NOT_SAME_DEVICE: code = "cross_device"; break;
      case ERROR_NOT_SUPPORTED: case ERROR_INVALID_FUNCTION: code = "unsupported"; break;
      case ERROR_INVALID_NAME: case ERROR_FILENAME_EXCED_RANGE: case ERROR_INVALID_PARAMETER: code = "invalid_argument"; break;
      default: code = "filesystem_error";
    }
  }
#elif defined(__APPLE__)
  char *from_utf8 = NULL, *to_utf8 = NULL;
  code = utf8_path(env, argv[0], &from_utf8);
  if (!code) code = utf8_path(env, argv[1], &to_utf8);
  if (!code) {
    if (renamex_np(from_utf8, to_utf8, RENAME_EXCL) == 0) code = "renamed";
    else {
      int error = errno;
      switch (error) {
        case EEXIST: case ENOTEMPTY: code = "occupied"; break;
        case ENOENT: case ENOTDIR: code = "source_unavailable"; break;
        case EACCES: case EPERM: case EROFS: code = "permission_denied"; break;
        case EBUSY: code = "busy"; break;
        case EXDEV: code = "cross_device"; break;
        case ENOTSUP: case ENOSYS: code = "unsupported"; break;
        case EINVAL: case ENAMETOOLONG: code = "invalid_argument"; break;
        default: code = "filesystem_error";
      }
    }
  }
  free(from_utf8); free(to_utf8);
#else
  code = "unsupported";
#endif
  free(from); free(to);
  return result(env, code);
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value function;
  if (napi_create_function(env, "renameNoReplace", NAPI_AUTO_LENGTH, rename_no_replace, NULL, &function) != napi_ok ||
      napi_set_named_property(env, exports, "renameNoReplace", function) != napi_ok) return NULL;
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
