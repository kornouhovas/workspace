import AppKit
import CoreGraphics
let pid = Int(CommandLine.arguments[1])!
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly,.excludeDesktopElements], kCGNullWindowID) as! [[String:Any]]
let selected = windows.filter { ($0[kCGWindowOwnerPID as String] as? Int) == pid }
let p = CGEvent(source: nil)!.location
let data: [String: Any] = ["pid":Int(NSWorkspace.shared.frontmostApplication?.processIdentifier ?? -1),"mouse":[p.x,p.y],"windows":selected]
print(String(data: try! JSONSerialization.data(withJSONObject:data,options:[.sortedKeys]),encoding:.utf8)!)
