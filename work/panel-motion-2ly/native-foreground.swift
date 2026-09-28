import AppKit
print(NSWorkspace.shared.frontmostApplication?.processIdentifier ?? -1)
