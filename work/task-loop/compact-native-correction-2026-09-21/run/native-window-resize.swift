import ApplicationServices
import Foundation

guard CommandLine.arguments.count == 3,
      let requestedWidth = Double(CommandLine.arguments[1]),
      let requestedHeight = Double(CommandLine.arguments[2]) else {
    fputs("usage: native-window-resize WIDTH HEIGHT\n", stderr)
    exit(2)
}
let pid: pid_t = 58040
let app = AXUIElementCreateApplication(pid)
var windowsValue: CFTypeRef?
guard AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &windowsValue) == .success,
      let windows = windowsValue as? [AXUIElement],
      let window = windows.first else {
    fputs("Could not read Electron accessibility window\n", stderr)
    exit(1)
}
var requested = CGSize(width: requestedWidth, height: requestedHeight)
guard let sizeValue = AXValueCreate(.cgSize, &requested) else {
    fputs("Could not create AX size value\n", stderr)
    exit(1)
}
let result = AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, sizeValue)
var actualValue: CFTypeRef?
var actual = CGSize.zero
if AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &actualValue) == .success,
   let ax = actualValue as! AXValue? {
    AXValueGetValue(ax, .cgSize, &actual)
}
print("AX set size result=\(result.rawValue) requested=\(requested) actual=\(actual)")
