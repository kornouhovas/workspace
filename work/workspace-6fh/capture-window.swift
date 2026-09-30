import AppKit
import CoreGraphics
import Darwin
import Foundation
let pid = Int(CommandLine.arguments[1])!
let output=CommandLine.arguments[2]
let windows=CGWindowListCopyWindowInfo([.optionAll],kCGNullWindowID) as? [[String:Any]] ?? []
guard let win=windows.first(where:{($0[kCGWindowOwnerPID as String] as? Int)==pid && ($0[kCGWindowLayer as String] as? Int)==0 && !($0[kCGWindowName as String] as? String ?? "").isEmpty}),let id=win[kCGWindowNumber as String] as? UInt32 else {print("No titled window");exit(1)}
print("window",win)
typealias Capture = @convention(c) (CGRect, CGWindowListOption, CGWindowID, CGWindowImageOption) -> Unmanaged<CGImage>?
guard let symbol=dlsym(UnsafeMutableRawPointer(bitPattern:-2),"CGWindowListCreateImage") else {print("No symbol");exit(1)}
let capture=unsafeBitCast(symbol,to:Capture.self)
guard let img=capture(.null,[.optionIncludingWindow],id,[.boundsIgnoreFraming,.nominalResolution])?.takeRetainedValue() else {print("No image");exit(1)}
print("pixels",img.width,img.height)
guard let data=NSBitmapImageRep(cgImage:img).representation(using:.png,properties:[:]) else {exit(1)}
try data.write(to:URL(fileURLWithPath:output))
