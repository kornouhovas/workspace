import AppKit
import CoreGraphics
import Darwin
import Foundation

guard CommandLine.arguments.count == 3,
      let pid = Int32(CommandLine.arguments[1]) else {
    fputs("usage: capture-native-window PID OUTPUT_PNG\n", stderr)
    exit(2)
}

typealias WindowCapture = @convention(c) (
    CGRect, CGWindowListOption, CGWindowID, CGWindowImageOption
) -> Unmanaged<CGImage>?

guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage") else {
    fputs("Legacy CoreGraphics window capture symbol is unavailable\n", stderr)
    exit(1)
}
let capture = unsafeBitCast(symbol, to: WindowCapture.self)

func workspaceWindow() -> (id: CGWindowID, bounds: CGRect)? {
    let windows = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
    for window in windows {
        guard (window[kCGWindowOwnerPID as String] as? Int) == Int(pid),
              (window[kCGWindowName as String] as? String) == "Workspace",
              (window[kCGWindowLayer as String] as? Int) == 0,
              let id = window[kCGWindowNumber as String] as? Int,
              let boundsDictionary = window[kCGWindowBounds as String] as? NSDictionary,
              let bounds = CGRect(dictionaryRepresentation: boundsDictionary),
              bounds.width >= 1024,
              bounds.height >= 700 else { continue }
        return (CGWindowID(id), bounds)
    }
    return nil
}

guard let app = NSRunningApplication(processIdentifier: pid) else {
    fputs("Expected Electron process is not running\n", stderr)
    exit(1)
}
for attempt in 1...5 {
    guard app.activate(options: [.activateAllWindows]) else {
        fputs("Could not activate exact Electron process\n", stderr)
        exit(1)
    }
    guard let window = workspaceWindow() else {
        fputs("No exact Workspace window for expected PID\n", stderr)
        exit(1)
    }
    if let image = capture(
        .null, [.optionIncludingWindow], window.id, [.boundsIgnoreFraming]
    )?.takeRetainedValue(),
       image.width >= Int(window.bounds.width * 1.8),
       image.height >= Int(window.bounds.height * 1.8),
       let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) {
        try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
        print("pid=\(pid) window=\(window.id) bounds=\(window.bounds) png=\(image.width)x\(image.height) attempt=\(attempt)")
        exit(0)
    }
    usleep(150_000)
}
fputs("Only a window thumbnail or no pixels were available after activation\n", stderr)
exit(1)
