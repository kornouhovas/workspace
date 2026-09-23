import CoreGraphics
import Foundation

let windows = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
for window in windows {
    guard let pid = window[kCGWindowOwnerPID as String] as? Int, pid == 7951 else { continue }
    let id = window[kCGWindowNumber as String] ?? "?"
    let layer = window[kCGWindowLayer as String] ?? "?"
    let title = window[kCGWindowName as String] ?? ""
    let bounds = window[kCGWindowBounds as String] ?? [:]
    let visible = window[kCGWindowIsOnscreen as String] ?? "?"
    print("pid=\(pid) id=\(id) layer=\(layer) visible=\(visible) title=\(title) bounds=\(bounds)")
}
