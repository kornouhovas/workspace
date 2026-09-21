import AppKit
import CoreGraphics
import Darwin
import Foundation

guard CommandLine.arguments.count == 3,
      let id = UInt32(CommandLine.arguments[1]) else {
    fputs("usage: native-window-capture WINDOW_ID OUTPUT_PATH\n", stderr)
    exit(2)
}
typealias WindowCapture = @convention(c) (
    CGRect, CGWindowListOption, CGWindowID, CGWindowImageOption
) -> Unmanaged<CGImage>?
guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage") else {
    fputs("Legacy CGWindowListCreateImage symbol is unavailable\n", stderr)
    exit(1)
}
let capture = unsafeBitCast(symbol, to: WindowCapture.self)
guard let image = capture(
    .null,
    [.optionIncludingWindow],
    id,
    [.boundsIgnoreFraming]
)?.takeRetainedValue() else {
    fputs("CGWindowListCreateImage returned nil for window \(id)\n", stderr)
    exit(1)
}
let representation = NSBitmapImageRep(cgImage: image)
guard let data = representation.representation(using: .png, properties: [:]) else {
    fputs("Could not encode PNG\n", stderr)
    exit(1)
}
try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
print("captured \(image.width)x\(image.height)")
