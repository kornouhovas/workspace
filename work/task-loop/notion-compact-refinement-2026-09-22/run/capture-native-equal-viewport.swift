import AppKit
import ApplicationServices
import CoreGraphics
import Darwin
import Foundation

guard (CommandLine.arguments.count == 3 || CommandLine.arguments.count == 5),
      let pid = Int32(CommandLine.arguments[1]) else {
    fputs("usage: capture-native-equal-viewport PID OUTPUT_PNG [WIDTH HEIGHT]\n", stderr)
    exit(2)
}
let targetWidth = CommandLine.arguments.count == 5 ? Double(CommandLine.arguments[3]) ?? 0 : 1486
let targetHeight = CommandLine.arguments.count == 5 ? Double(CommandLine.arguments[4]) ?? 0 : 1059
guard targetWidth >= 1024, targetHeight >= 720 else {
    fputs("Invalid requested viewport\n", stderr)
    exit(2)
}
let display = CGMainDisplayID()
guard let originalMode = CGDisplayCopyDisplayMode(display),
      let modes = CGDisplayCopyAllDisplayModes(display, nil) as? [CGDisplayMode],
      let captureMode = modes.first(where: {
          $0.width == 2048 && $0.height == 1280 &&
          $0.pixelWidth == 2048 && $0.pixelHeight == 1280 &&
          $0.refreshRate == originalMode.refreshRate
      }) ?? modes.first(where: {
          $0.width == 2048 && $0.height == 1280 &&
          $0.pixelWidth == 2048 && $0.pixelHeight == 1280
      }) else {
    fputs("No temporary 2048x1280 display mode\n", stderr)
    exit(1)
}
typealias WindowCapture = @convention(c) (
    CGRect, CGWindowListOption, CGWindowID, CGWindowImageOption
) -> Unmanaged<CGImage>?
guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage") else {
    fputs("Legacy CoreGraphics window capture symbol unavailable\n", stderr)
    exit(1)
}
let capture = unsafeBitCast(symbol, to: WindowCapture.self)
guard CGDisplaySetDisplayMode(display, captureMode, nil) == .success else {
    fputs("Could not enter temporary capture display mode\n", stderr)
    exit(1)
}
func performCapture() -> Bool {
    usleep(300_000)
    let appElement = AXUIElementCreateApplication(pid)
    var windowsValue: CFTypeRef?
    guard AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsValue) == .success,
          let windows = windowsValue as? [AXUIElement],
          let axWindow = windows.first else {
        fputs("Exact Electron AX window missing after mode change\n", stderr)
        return false
    }
    var requestedSize = CGSize(width: targetWidth, height: targetHeight)
    guard let sizeValue = AXValueCreate(.cgSize, &requestedSize),
          AXUIElementSetAttributeValue(axWindow, kAXSizeAttribute as CFString, sizeValue) == .success else {
        fputs("Could not size Electron window to \(targetWidth)x\(targetHeight)\n", stderr)
        return false
    }
    var actualValue: CFTypeRef?
    var actualSize = CGSize.zero
    guard AXUIElementCopyAttributeValue(axWindow, kAXSizeAttribute as CFString, &actualValue) == .success,
          let actualAX = actualValue as! AXValue?,
          AXValueGetValue(actualAX, .cgSize, &actualSize),
          actualSize.width == targetWidth,
          actualSize.height == targetHeight else {
        fputs("Window did not reach requested viewport; actual=\(actualSize)\n", stderr)
        return false
    }
    usleep(500_000)
    guard let app = NSRunningApplication(processIdentifier: pid) else {
        fputs("Expected Electron PID is not running\n", stderr)
        return false
    }
    for attempt in 1...12 {
        guard app.activate(options: [.activateAllWindows]) else {
            fputs("Could not activate exact Electron app\n", stderr)
            return false
        }
        _ = AXUIElementSetAttributeValue(axWindow, kAXSizeAttribute as CFString, sizeValue)
        usleep(120_000)
        let windows = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
        guard let window = windows.first(where: {
            ($0[kCGWindowOwnerPID as String] as? Int) == Int(pid) &&
            ($0[kCGWindowName as String] as? String) == "Workspace" &&
            ($0[kCGWindowLayer as String] as? Int) == 0
        }),
        let id = window[kCGWindowNumber as String] as? Int,
        let boundsDictionary = window[kCGWindowBounds as String] as? NSDictionary,
        let bounds = CGRect(dictionaryRepresentation: boundsDictionary) else {
            fputs("Exact Workspace window not found in CoreGraphics list\n", stderr)
            return false
        }
        if bounds.width != targetWidth || bounds.height != targetHeight {
            usleep(200_000)
            continue
        }
        if let image = capture(
            .null, [.optionIncludingWindow], CGWindowID(id), [.boundsIgnoreFraming]
        )?.takeRetainedValue(),
           image.width == Int(targetWidth),
           image.height == Int(targetHeight),
           let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) {
            do {
                try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
                print("pid=\(pid) window=\(id) bounds=\(bounds) png=\(image.width)x\(image.height) attempt=\(attempt)")
                return true
            } catch {
                fputs("Could not save PNG: \(error)\n", stderr)
                return false
            }
        }
        usleep(150_000)
    }
    fputs("Only a thumbnail or no window pixels were available\n", stderr)
    return false
}

let captured = performCapture()
var restoreResult = CGError.failure
for _ in 1...3 {
    restoreResult = CGDisplaySetDisplayMode(display, originalMode, nil)
    if restoreResult == .success { break }
    usleep(200_000)
}
print("restored_display=\(restoreResult.rawValue) mode=\(originalMode.width)x\(originalMode.height)")
if restoreResult != .success || !captured { exit(1) }
