import CoreGraphics
import Foundation
let point = CGPoint(x: Double(CommandLine.arguments[1])!, y: Double(CommandLine.arguments[2])!)
for kind in [CGEventType.mouseMoved, .leftMouseDown, .leftMouseUp] {
    guard let event = CGEvent(mouseEventSource: nil, mouseType: kind, mouseCursorPosition: point, mouseButton: .left) else { fatalError("CGEvent unavailable") }
    event.post(tap: .cghidEventTap)
    Thread.sleep(forTimeInterval: 0.08)
}
