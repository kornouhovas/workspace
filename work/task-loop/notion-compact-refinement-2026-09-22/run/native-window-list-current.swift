import CoreGraphics
import Foundation

guard CommandLine.arguments.count == 2, let targetPID = Int(CommandLine.arguments[1]) else {
    fputs("usage: native-window-list-current.swift PID\n", stderr)
    exit(2)
}

let windows = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
for window in windows {
    guard let pid = window[kCGWindowOwnerPID as String] as? Int, pid == targetPID else { continue }
    let id = window[kCGWindowNumber as String] ?? "?"
    let layer = window[kCGWindowLayer as String] ?? "?"
    let title = window[kCGWindowName as String] ?? ""
    let bounds = window[kCGWindowBounds as String] ?? [:]
    let visible = window[kCGWindowIsOnscreen as String] ?? "?"
    print("pid=\(pid) id=\(id) layer=\(layer) visible=\(visible) title=\(title) bounds=\(bounds)")
}
