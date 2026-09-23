import AppKit
import Foundation

guard CommandLine.arguments.count == 2, let pid = Int32(CommandLine.arguments[1]),
      let app = NSRunningApplication(processIdentifier: pid) else {
    fputs("usage: activate-native-app.swift PID\n", stderr)
    exit(2)
}

print("before active=\(app.isActive) hidden=\(app.isHidden) terminated=\(app.isTerminated)")
app.unhide()
let result = app.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
print("activate=\(result)")
usleep(700_000)
print("after active=\(app.isActive) hidden=\(app.isHidden) terminated=\(app.isTerminated)")
