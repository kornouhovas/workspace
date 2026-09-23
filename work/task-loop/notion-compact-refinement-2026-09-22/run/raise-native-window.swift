import AppKit
import ApplicationServices
import Foundation

guard CommandLine.arguments.count == 2, let pid = Int32(CommandLine.arguments[1]) else {
    fputs("usage: raise-native-window.swift PID\n", stderr)
    exit(2)
}

func copyValue(_ element: AXUIElement, _ attribute: String) -> CFTypeRef? {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
    print("copy \(attribute): result=\(result.rawValue) value=\(String(describing: value))")
    return result == .success ? value : nil
}

let appElement = AXUIElementCreateApplication(pid)
guard let windowValues = copyValue(appElement, kAXWindowsAttribute) as? [AXUIElement],
      let window = windowValues.first else {
    fputs("No AX window for PID \(pid)\n", stderr)
    exit(1)
}

var actions: CFArray?
let actionsResult = AXUIElementCopyActionNames(window, &actions)
print("actions result=\(actionsResult.rawValue) names=\(String(describing: actions))")
_ = copyValue(window, kAXTitleAttribute)
_ = copyValue(window, kAXPositionAttribute)
_ = copyValue(window, kAXSizeAttribute)
_ = copyValue(window, kAXMinimizedAttribute)

let unminimize = AXUIElementSetAttributeValue(window, kAXMinimizedAttribute as CFString, kCFBooleanFalse)
let raise = AXUIElementPerformAction(window, kAXRaiseAction as CFString)
let activate = NSRunningApplication(processIdentifier: pid)?.activate(options: [.activateAllWindows]) ?? false
print("unminimize=\(unminimize.rawValue) raise=\(raise.rawValue) activate=\(activate)")
usleep(500_000)

_ = copyValue(window, kAXPositionAttribute)
_ = copyValue(window, kAXSizeAttribute)
_ = copyValue(window, kAXMinimizedAttribute)
