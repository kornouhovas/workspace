"""Prepare an addressable disposable Electron bundle; does not drive its UI."""
import json
import pathlib
import plistlib
import shutil
import sys

checkout = pathlib.Path(__file__).resolve().parents[2]
manifest_path = pathlib.Path(sys.argv[1]).resolve()
fixture = json.loads(manifest_path.read_text())
bundle = pathlib.Path(fixture['fixture']) / 'WorkspaceAudit389.app'
if not bundle.exists():
    shutil.copytree(checkout / 'node_modules/electron/dist/Electron.app', bundle, symlinks=True)
    plist = bundle / 'Contents/Info.plist'
    with plist.open('rb') as stream:
        info = plistlib.load(stream)
    info.update(CFBundleIdentifier='local.workspace.audit389', CFBundleName='WorkspaceAudit389', CFBundleDisplayName='WorkspaceAudit389')
    with plist.open('wb') as stream:
        plistlib.dump(info, stream)
fixture['app'] = str(bundle)
manifest_path.write_text(json.dumps(fixture, indent=2) + '\n')
print(bundle)
