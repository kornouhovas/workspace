import AppKit
import ApplicationServices
import CoreGraphics
import Darwin
import Foundation

guard CommandLine.arguments.count == 5,
      let pid = Int32(CommandLine.arguments[1]),
      let targetWidth = Double(CommandLine.arguments[3]),
      let targetHeight = Double(CommandLine.arguments[4]),
      targetWidth >= 1024,
      targetHeight >= 720 else {
    fputs("usage: capture-native-current-display PID OUTPUT_PNG WIDTH HEIGHT\n", stderr)
    exit(2)
}

typealias WindowCapture = @convention(c) (
    CGRect, CGWindowListOption, CGWindowID, CGWindowImageOption
) -> Unmanaged<CGImage>?
guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage") else {
    fputs("Legacy CoreGraphics window capture symbol unavailable\n", stderr)
    exit(1)
}
let capture = unsafeBitCast(symbol, to: WindowCapture.self)
let appElement = AXUIElementCreateApplication(pid)
var windowsValue: CFTypeRef?
guard AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsValue) == .success,
      let windows = windowsValue as? [AXUIElement],
      let axWindow = windows.first else {
    fputs("Exact Electron AX window missing\n", stderr)
    exit(1)
}

var requestedSize = CGSize(width: targetWidth, height: targetHeight)
guard let sizeValue = AXValueCreate(.cgSize, &requestedSize),
      AXUIElementSetAttributeValue(axWindow, kAXSizeAttribute as CFString, sizeValue) == .success else {
    fputs("Could not size Electron window\n", stderr)
    exit(1)
}

let screen = NSScreen.main?.visibleFrame ?? CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight)
var requestedPosition = CGPoint(
    x: max(screen.minX, screen.minX + (screen.width - targetWidth) / 2),
    y: max(0, screen.minY + (screen.height - targetHeight) / 2)
)
if let positionValue = AXValueCreate(.cgPoint, &requestedPosition) {
    _ = AXUIElementSetAttributeValue(axWindow, kAXPositionAttribute as CFString, positionValue)
}

guard let app = NSRunningApplication(processIdentifier: pid),
      app.activate(options: [.activateAllWindows]) else {
    fputs("Could not activate exact Electron app\n", stderr)
    exit(1)
}

for attempt in 1...12 {
    _ = AXUIElementSetAttributeValue(axWindow, kAXSizeAttribute as CFString, sizeValue)
    usleep(180_000)
    let windowList = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
    guard let window = windowList.first(where: {
        ($0[kCGWindowOwnerPID as String] as? Int) == Int(pid) &&
        ($0[kCGWindowName as String] as? String) == "Workspace" &&
        ($0[kCGWindowLayer as String] as? Int) == 0
    }),
    let id = window[kCGWindowNumber as String] as? Int,
    let boundsDictionary = window[kCGWindowBounds as String] as? NSDictionary,
    let bounds = CGRect(dictionaryRepresentation: boundsDictionary) else {
        fputs("Exact Workspace window missing from CoreGraphics list\n", stderr)
        exit(1)
    }
    guard bounds.width == targetWidth, bounds.height == targetHeight else { continue }
    if let image = capture(.null, [.optionIncludingWindow], CGWindowID(id), [.boundsIgnoreFraming])?.takeRetainedValue(),
       image.width == Int(targetWidth), image.height == Int(targetHeight),
       let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) {
        try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
        print("pid=\(pid) window=\(id) bounds=\(bounds) png=\(image.width)x\(image.height) attempt=\(attempt) display=\(screen)")
        exit(0)
    }
}
fputs("Window did not reach requested bounds or pixels were unavailable\n", stderr)
exit(1)
