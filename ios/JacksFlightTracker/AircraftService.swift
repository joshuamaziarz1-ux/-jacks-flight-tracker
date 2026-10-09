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
    // Community-operated feeds. Each source currently permits personal,
    // non-commercial use without an API key. Respect their rate limits.
    private let registrationEndpoints = [
        "https://opendata.adsb.fi/api/v2/registration/",
        "https://api.adsb.lol/v2/reg/"
    ]
    private let nearbyEndpoints = [
        "https://opendata.adsb.fi/api/v3/lat/41.13/lon/-85.14/dist/125",
        "https://api.adsb.lol/v2/point/41.13/-85.14/125"
    ]

    func lookUp(registration: String) async throws -> TrackedAircraft? {
        let safe = registration.uppercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }
        guard safe == registration.uppercased(), !safe.isEmpty else {
            throw FlightDataError.badResponse
        }
        var reachedAnyProvider = false
        for prefix in registrationEndpoints {
            guard let url = URL(string: prefix + safe) else { continue }
            do {
                let planes = try await fetch(url)
                reachedAnyProvider = true
                if let match = planes.first(where: { $0.registration.caseInsensitiveCompare(safe) == .orderedSame }) {
                    return match
                }
            } catch {
                continue // Try another free provider if this service is unavailable.
            }
        }
        if reachedAnyProvider { return nil }
        throw FlightDataError.badResponse
    }

    func findAirborneNearFortWayne() async throws -> TrackedAircraft {
        var reachedAnyProvider = false
        for endpoint in nearbyEndpoints {
            guard let url = URL(string: endpoint) else { continue }
            do {
                let candidates = try await fetch(url)
                    .filter { !$0.isOnGround && $0.isLive && !$0.registration.isEmpty }
                reachedAnyProvider = true
                if let airplane = candidates.sorted(by: { $0.positionAge < $1.positionAge }).first {
                    return airplane
                }
            } catch {
                continue // Fallback to another no-key data source.
            }
        }
        if reachedAnyProvider { throw FlightDataError.noTestAircraft }
        throw FlightDataError.badResponse
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
        let serverTime = number(body["now"]) ?? Date().timeIntervalSince1970
        // ADS-B-compatible APIs differ: now may be epoch seconds or milliseconds.
        let now = serverTime > 10_000_000_000 ? serverTime / 1000 : serverTime
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
