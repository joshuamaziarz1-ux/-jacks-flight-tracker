import SwiftUI

@main
struct JacksFlightTrackerApp: App {
    var body: some Scene {
        WindowGroup {
            TrackerView()
                .preferredColorScheme(.dark)
        }
    }
}
