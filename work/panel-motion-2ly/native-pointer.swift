import CoreGraphics
import Foundation
let action = CommandLine.arguments[1]
let point = CGPoint(x: Double(CommandLine.arguments[2])!, y: Double(CommandLine.arguments[3])!)
let kind: CGEventType = action == "down" ? .leftMouseDown : action == "up" ? .leftMouseUp : action == "drag" ? .leftMouseDragged : .mouseMoved
guard let event = CGEvent(mouseEventSource: nil, mouseType: kind, mouseCursorPosition: point, mouseButton: .left) else { fatalError("CGEvent unavailable") }
event.post(tap: .cghidEventTap)
Thread.sleep(forTimeInterval: 0.025)
