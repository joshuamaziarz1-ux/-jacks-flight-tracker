import AppKit
import Foundation

// Creates the iPhone app icon as part of the build on a Mac.
let size = 1024
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
), let drawingContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fatalError("Unable to create icon bitmap")
}
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = drawingContext

NSColor(calibratedRed: 0.035, green: 0.086, blue: 0.153, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: size, height: size)).fill()

let ring = NSBezierPath(ovalIn: NSRect(x: 112, y: 112, width: 800, height: 800))
ring.lineWidth = 38
NSColor(calibratedRed: 0.067, green: 0.70, blue: 0.80, alpha: 1).setStroke()
ring.stroke()

let points: [(CGFloat, CGFloat)] = [
    (512, 834), (556, 670), (717, 568), (728, 507),
    (560, 537), (556, 355), (630, 301), (630, 241),
    (512, 279), (394, 241), (394, 301), (468, 355),
    (464, 537), (296, 507), (307, 568), (468, 670)
]
let plane = NSBezierPath()
plane.move(to: CGPoint(x: points[0].0, y: points[0].1))
for item in points.dropFirst() {
    plane.line(to: CGPoint(x: item.0, y: item.1))
}
plane.close()
NSColor(calibratedRed: 0.957, green: 0.984, blue: 1.0, alpha: 1).setFill()
plane.fill()
drawingContext.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

let outputDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("JacksFlightTracker/Assets.xcassets/AppIcon.appiconset", isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Unable to save app icon")
}
try png.write(to: outputDirectory.appendingPathComponent("AppIcon.png"))
print("Generated Jack's Flight Tracker app icon")
