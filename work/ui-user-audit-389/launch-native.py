"""Launch only: production Electron entrypoint with isolated fixture storage."""
import json
import os
import pathlib
import subprocess
import sys

checkout = pathlib.Path(__file__).resolve().parents[2]
fixture = json.loads(pathlib.Path(sys.argv[1]).read_text())
environment = dict(os.environ, WORKSPACE_DEV='1', WORKSPACE_DEV_DATA=fixture['metadata'], WORKSPACE_DEV_URL='')
result = subprocess.run([str(pathlib.Path(fixture['app']) / 'Contents/MacOS/Electron'), 'electron/main.js'], cwd=checkout, env=environment)
sys.exit(result.returncode)
