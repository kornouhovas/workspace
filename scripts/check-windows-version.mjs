import assert from "node:assert/strict";

export function checkWindowsVersion(metadata, version) {
  // Windows exposes both SemVer display strings and four-part VERSIONINFO.
  // Only a zero revision is equivalent to this canonical product version.
  for (const key of ["product", "file"]) {
    assert.ok(metadata[key] === version || metadata[key] === `${version}.0`,
      `Windows ${key} version differs from canonical ${version}: ${metadata[key]}`);
  }
  assert.equal(metadata.name, "Workspace");
  assert.equal(metadata.signature, "NotSigned", "No validated signing identity is claimed");
}
