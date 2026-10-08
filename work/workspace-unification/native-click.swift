import AppKit
import CoreGraphics
import Foundation
let pid = Int32(CommandLine.arguments[1])!
let point = CGPoint(x: Double(CommandLine.arguments[2])!, y: Double(CommandLine.arguments[3])!)
guard let app = NSRunningApplication(processIdentifier: pid) else { fatalError("Fixture process unavailable") }
app.activate(options: [.activateAllWindows])
Thread.sleep(forTimeInterval: 0.4)
guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else { fatalError("Fixture is not foreground") }
for kind in [CGEventType.mouseMoved, .leftMouseDown, .leftMouseUp] {
    guard let event = CGEvent(mouseEventSource: nil, mouseType: kind, mouseCursorPosition: point, mouseButton: .left) else { fatalError("CGEvent unavailable") }
    event.post(tap: .cghidEventTap)
    Thread.sleep(forTimeInterval: 0.08)
}
print("Native pointer", pid, point.x, point.y)
