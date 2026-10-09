import Foundation
import CoreLocation

struct TrackedAircraft: Identifiable {
    let id: String
    let registration: String
    let flight: String
    let model: String
    let coordinate: CLLocationCoordinate2D
    let altitudeFeet: Int?
    let groundSpeedKnots: Int?
    let headingDegrees: Double?
    let lastPositionTime: Date
    let isOnGround: Bool

    var positionAge: TimeInterval { Date().timeIntervalSince(lastPositionTime) }
    var isLive: Bool { positionAge < 120 }
}

enum FlightDataError: LocalizedError {
    case badResponse
    case malformedResponse
    case noTestAircraft

    var errorDescription: String? {
        switch self {
        case .badResponse: return "The flight data service is unavailable. Try again shortly."
        case .malformedResponse: return "The flight data response could not be read."
        case .noTestAircraft: return "No nearby airborne aircraft with a visible tail number was found. Try again later."
        }
    }
}

struct AircraftService {
    private let apiBase = "https://api.adsb.lol"

    func lookUp(registration: String) async throws -> TrackedAircraft? {
        let safe = registration.uppercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }
        guard safe == registration.uppercased(), !safe.isEmpty,
              let url = URL(string: "\(apiBase)/v2/reg/\(safe)") else {
            throw FlightDataError.badResponse
        }
        let planes = try await fetch(url)
        return planes.first { $0.registration.caseInsensitiveCompare(safe) == .orderedSame }
            ?? planes.first
    }

    func findAirborneNearFortWayne() async throws -> TrackedAircraft {
        // Radius is in nautical miles. This covers Fort Wayne and DeKalb airports.
        guard let url = URL(string: "\(apiBase)/v2/lat/41.13/lon/-85.14/dist/125") else {
            throw FlightDataError.badResponse
        }
        let candidates = try await fetch(url)
            .filter { !$0.isOnGround && $0.isLive && !$0.registration.isEmpty }
        guard let airplane = candidates.sorted(by: { $0.positionAge < $1.positionAge }).first else {
            throw FlightDataError.noTestAircraft
        }
        return airplane
    }

    private func fetch(_ url: URL) async throws -> [TrackedAircraft] {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse, response.statusCode == 200 else {
            throw FlightDataError.badResponse
        }
        guard let body = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let items = body["ac"] as? [[String: Any]] else {
            throw FlightDataError.malformedResponse
        }
        let now = number(body["now"]) ?? Date().timeIntervalSince1970
        return items.compactMap { item -> TrackedAircraft? in
            guard let lat = number(item["lat"]), let lon = number(item["lon"]),
                  (-90...90).contains(lat), (-180...180).contains(lon) else { return nil }
            let registration = (item["r"] as? String ?? "").trimmingCharacters(in: .whitespaces)
            let hex = item["hex"] as? String ?? registration
            let alt = number(item["alt_baro"]) ?? number(item["alt_geom"])
            let onGround = (item["alt_baro"] as? String)?.lowercased() == "ground"
            let age = max(0, number(item["seen_pos"]) ?? 99999)
            return TrackedAircraft(
                id: hex,
                registration: registration,
                flight: (item["flight"] as? String ?? "").trimmingCharacters(in: .whitespaces),
                model: (item["t"] as? String ?? "").trimmingCharacters(in: .whitespaces),
                coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon),
                altitudeFeet: alt.map { Int($0.rounded()) },
                groundSpeedKnots: number(item["gs"]).map { Int($0.rounded()) },
                headingDegrees: number(item["track"]),
                lastPositionTime: Date(timeIntervalSince1970: now - age),
                isOnGround: onGround
            )
        }
    }

    private func number(_ value: Any?) -> Double? {
        (value as? NSNumber)?.doubleValue
    }
}
