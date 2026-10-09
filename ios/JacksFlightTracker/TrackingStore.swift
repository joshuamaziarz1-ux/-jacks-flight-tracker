import Foundation
import CoreLocation
import Combine

@MainActor
final class TrackingStore: ObservableObject {
    static let jackTail = "N233ND"

    @Published var tailInput: String = jackTail
    @Published private(set) var watchedTail: String = ""
    @Published private(set) var aircraft: TrackedAircraft?
    @Published private(set) var trail: [CLLocationCoordinate2D] = []
    @Published private(set) var status = "Ready. Choose an airplane to check its position."
    @Published private(set) var lastChecked: Date?
    @Published private(set) var isLoading = false
    @Published private(set) var isFindingTestPlane = false
    @Published var followAircraft = true

    private let service = AircraftService()

    func startSearch() async {
        let trimmed = tailInput.uppercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let cleaned = trimmed.filter { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }
        guard !cleaned.isEmpty, cleaned == trimmed else {
            status = "Enter a valid aircraft tail number."
            return
        }
        watchedTail = cleaned
        tailInput = cleaned
        aircraft = nil
        trail = []
        status = "Searching for \(cleaned)…"
        await refresh()
    }

    func returnToJack() async {
        tailInput = Self.jackTail
        await startSearch()
    }

    func stopTracking() {
        watchedTail = ""
        aircraft = nil
        trail = []
        lastChecked = nil
        followAircraft = true
        status = "Not tracking. Saved aircraft are only checked when selected."
    }

    func refresh() async {
        guard !watchedTail.isEmpty && !isLoading && !isFindingTestPlane else { return }
        isLoading = true
        defer { isLoading = false }
        let requestedTail = watchedTail
        do {
            let incoming = try await service.lookUp(registration: requestedTail)
            guard watchedTail == requestedTail else { return }
            lastChecked = Date()
            if let incoming {
                if aircraft?.id != incoming.id { trail = [] }
                if incoming.isLive {
                    if let previous = trail.last {
                        let from = CLLocation(latitude: previous.latitude, longitude: previous.longitude)
                        let to = CLLocation(latitude: incoming.coordinate.latitude, longitude: incoming.coordinate.longitude)
                        if from.distance(from: to) > 30 {
                            trail.append(incoming.coordinate)
                        }
                    } else {
                        trail.append(incoming.coordinate)
                    }
                    if trail.count > 400 { trail.removeFirst(trail.count - 400) }
                }
                aircraft = incoming
                status = incoming.isLive
                    ? (incoming.isOnGround ? "Aircraft reporting on the ground" : "Aircraft reporting a live position")
                    : "Last received aircraft position is old"
            } else {
                // Keep previous coordinates, but never pretend the old point is live.
                status = "No current public position for \(requestedTail). It may be on the ground or outside receiver coverage."
            }
        } catch {
            guard watchedTail == requestedTail else { return }
            lastChecked = Date()
            status = error.localizedDescription
        }
    }

    func findTestPlane() async {
        guard !isFindingTestPlane && !isLoading else { return }
        isFindingTestPlane = true
        status = "Finding an aircraft in the air near Fort Wayne…"
        defer { isFindingTestPlane = false }
        do {
            let test = try await service.findAirborneNearFortWayne()
            tailInput = test.registration
            watchedTail = test.registration
            aircraft = test
            trail = [test.coordinate]
            lastChecked = Date()
            followAircraft = true
            status = "Test aircraft found! Tracking \(test.registration)."
        } catch {
            status = error.localizedDescription
        }
    }
}
