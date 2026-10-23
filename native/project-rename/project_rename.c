#include <node_api.h>
#include <stdint.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#ifdef _WIN32
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0602
#endif
#include <windows.h>
#elif defined(__APPLE__)
#include <stdio.h>
#include <errno.h>
#include <sys/attr.h>
#include <sys/mount.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
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


/* Read-only durable evidence shares the fixed, packaged N-API boundary. */
static void field(napi_env env, napi_value object, const char *name, const char *value) {
  napi_set_named_property(env, object, name, result(env, value));
}
static napi_value observe_folder(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2], object;
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 1) return result(env, "missing_attributes");
  uint16_t *wide = NULL;
  if (read_path(env, argv[0], &wide)) return result(env, "missing_attributes");
  char volume[256] = {0}, serial[64] = {0}, file_id[64] = {0}, created[64] = {0};
  const char *reason = NULL;
#ifdef __APPLE__
  char *path = NULL;
  if (utf8_path(env, argv[0], &path)) { free(wide); return result(env, "missing_attributes"); }
  struct stat before, after;
  struct statfs mount_before, mount_after;
  int fd = open(path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
  if (fd < 0) reason = errno == EACCES || errno == EPERM ? "permission_denied" : errno == ENOENT || errno == ENOTDIR ? "disconnected" : "unsupported";
  else if (fstat(fd, &before) || fstatfs(fd, &mount_before)) reason = "missing_attributes";
  else if (!(mount_before.f_flags & MNT_LOCAL) || strcmp(mount_before.f_fstypename, "apfs") != 0) reason = "unsupported";
  else {
    struct attrlist attrs = {0};
    attrs.bitmapcount = ATTR_BIT_MAP_COUNT;
    attrs.commonattr = ATTR_CMN_RETURNED_ATTRS | ATTR_CMN_CRTIME | ATTR_CMN_FILEID;
    struct __attribute__((packed, aligned(4))) { uint32_t length; attribute_set_t returned; struct timespec birth; uint64_t id; } folder = {0};
    if (fgetattrlist(fd, &attrs, &folder, sizeof(folder), FSOPT_REPORT_FULLSIZE) ||
        folder.length != sizeof(folder) ||
        (folder.returned.commonattr & (ATTR_CMN_CRTIME | ATTR_CMN_FILEID)) != (ATTR_CMN_CRTIME | ATTR_CMN_FILEID) ||
        !folder.id || folder.birth.tv_sec <= 0) reason = "missing_attributes";
    else {
      attrs.commonattr = ATTR_CMN_RETURNED_ATTRS;
      attrs.volattr = ATTR_VOL_INFO | ATTR_VOL_UUID | ATTR_VOL_CAPABILITIES;
      struct __attribute__((packed, aligned(4))) { uint32_t length; attribute_set_t returned; vol_capabilities_attr_t capabilities; unsigned char uuid[16]; } vol = {0};
      struct statfs volume_mount;
      if (statfs(mount_before.f_mntonname, &volume_mount) ||
          memcmp(&volume_mount.f_fsid, &mount_before.f_fsid, sizeof(fsid_t)) ||
          getattrlist(mount_before.f_mntonname, &attrs, &vol, sizeof(vol), FSOPT_REPORT_FULLSIZE) ||
          vol.length != sizeof(vol) || (vol.returned.volattr & (ATTR_VOL_UUID | ATTR_VOL_CAPABILITIES)) != (ATTR_VOL_UUID | ATTR_VOL_CAPABILITIES) ||
          !(vol.capabilities.valid[VOL_CAPABILITIES_FORMAT] & VOL_CAP_FMT_PERSISTENTOBJECTIDS) ||
          !(vol.capabilities.capabilities[VOL_CAPABILITIES_FORMAT] & VOL_CAP_FMT_PERSISTENTOBJECTIDS)) reason = "unsupported";
      else {
        int nonzero = 0;
        for (size_t i = 0; i < 16; i++) { snprintf(volume + i * 2, 3, "%02x", vol.uuid[i]); nonzero |= vol.uuid[i]; }
        if (!nonzero) reason = "missing_attributes";
        snprintf(file_id, sizeof(file_id), "%" PRIu64, folder.id);
        snprintf(created, sizeof(created), "%" PRIu64, (uint64_t)folder.birth.tv_sec * 1000000000 + (uint64_t)folder.birth.tv_nsec);
        if (statfs(mount_before.f_mntonname, &volume_mount) || memcmp(&volume_mount.f_fsid, &mount_before.f_fsid, sizeof(fsid_t)) ||
            fstat(fd, &after) || fstatfs(fd, &mount_after) || before.st_dev != after.st_dev || before.st_ino != after.st_ino ||
            memcmp(&mount_before.f_fsid, &mount_after.f_fsid, sizeof(fsid_t)) ||
            strcmp(mount_before.f_mntonname, mount_after.f_mntonname) || lstat(path, &after) ||
            !S_ISDIR(after.st_mode) || before.st_dev != after.st_dev || before.st_ino != after.st_ino) reason = "changed";
      }
    }
  }
  if (fd >= 0) close(fd);
  free(path);
#elif defined(_WIN32)
  HANDLE handle = CreateFileW((LPCWSTR)wide, FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    NULL, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, NULL);
  if (handle == INVALID_HANDLE_VALUE) {
    DWORD error = GetLastError();
    reason = error == ERROR_ACCESS_DENIED ? "permission_denied" : error == ERROR_FILE_NOT_FOUND || error == ERROR_PATH_NOT_FOUND ? "disconnected" : "unsupported";
  } else {
    FILE_ID_INFO id; FILE_BASIC_INFO basic; WCHAR root[MAX_PATH], guid[MAX_PATH], filesystem[MAX_PATH];
    if (!GetFileInformationByHandleEx(handle, FileIdInfo, &id, sizeof(id)) ||
        !GetFileInformationByHandleEx(handle, FileBasicInfo, &basic, sizeof(basic))) reason = "missing_attributes";
    else if (!(basic.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) || (basic.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT)) reason = "changed";
    else if (!GetVolumePathNameW((LPCWSTR)wide, root, MAX_PATH) || !GetVolumeNameForVolumeMountPointW(root, guid, MAX_PATH) ||
        !GetVolumeInformationW(root, NULL, 0, NULL, NULL, NULL, filesystem, MAX_PATH) || wcscmp(filesystem, L"NTFS") != 0 ||
        GetDriveTypeW(root) != DRIVE_FIXED) reason = "unsupported";
    else {
      WCHAR final_path[32768];
      DWORD length = GetFinalPathNameByHandleW(handle, final_path, 32768, VOLUME_NAME_GUID);
      size_t guid_length = wcslen(guid);
      if (!length || length >= 32768 || _wcsnicmp(final_path, guid, guid_length) != 0) reason = "changed";
      else if (!WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, guid, -1, volume, sizeof(volume), NULL, NULL)) reason = "missing_attributes";
      else {
        snprintf(serial, sizeof(serial), "%" PRIu64, (uint64_t)id.VolumeSerialNumber);
        int nonzero = 0;
        for (size_t i = 0; i < 16; i++) { snprintf(file_id + i * 2, 3, "%02x", id.FileId.Identifier[i]); nonzero |= id.FileId.Identifier[i]; }
        snprintf(created, sizeof(created), "%" PRIu64, (uint64_t)basic.CreationTime.QuadPart);
        FILE_ID_INFO after;
        if (!nonzero || basic.CreationTime.QuadPart <= 0 || id.VolumeSerialNumber == 0) reason = "missing_attributes";
        else if (!GetFileInformationByHandleEx(handle, FileIdInfo, &after, sizeof(after)) || memcmp(&id, &after, sizeof(id))) reason = "changed";
      }
    }
    CloseHandle(handle);
  }
#else
  reason = "unsupported";
#endif
  free(wide);
  if (reason) return result(env, reason);
  napi_create_object(env, &object);
  field(env, object, "volume", volume); field(env, object, "serial", serial);
  field(env, object, "fileId", file_id); field(env, object, "created", created);
  return object;
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value function;
  if (napi_create_function(env, "renameNoReplace", NAPI_AUTO_LENGTH, rename_no_replace, NULL, &function) != napi_ok ||
      napi_set_named_property(env, exports, "renameNoReplace", function) != napi_ok) return NULL;
  if (napi_create_function(env, "observeFolder", NAPI_AUTO_LENGTH, observe_folder, NULL, &function) != napi_ok ||
      napi_set_named_property(env, exports, "observeFolder", function) != napi_ok) return NULL;
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
