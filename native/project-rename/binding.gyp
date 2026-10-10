{
  "targets": [{
    "target_name": "project_rename",
    "sources": ["project_rename.c"],
    "defines": ["NAPI_VERSION=8"],
    "conditions": [
      ["OS=='mac'", { "xcode_settings": { "WARNING_CFLAGS": ["-Wall", "-Wextra", "-Werror"] } }],
      ["OS=='win'", { "msvs_settings": { "VCCLCompilerTool": { "WarningLevel": 4, "WarnAsError": "true" } } }]
    ]
  }]
}
