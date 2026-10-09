import SwiftUI
import MapKit

struct TrackerView: View {
    @StateObject private var store = TrackingStore()
    @State private var mapCamera: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 41.13, longitude: -85.14),
            span: MKCoordinateSpan(latitudeDelta: 0.8, longitudeDelta: 0.8)
        )
    )
    @FocusState private var searchFocused: Bool

    var body: some View {
        ZStack {
            Color(red: 0.035, green: 0.075, blue: 0.13).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    searchCard
                    SavedAircraftView(tracker: store)
                    mapCard
                    aircraftCard
                    buttons
                    Text("Aircraft positions depend on public ADS-B reception and can disappear or be delayed. Tracking an airplane does not confirm who is aboard. Not for safety or emergency monitoring.")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.52))
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Aircraft data: adsb.fi (personal use) / adsb.lol (ODbL 1.0)")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.42))
                }
                .padding(18)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .task {
            await store.refresh()
            while !Task.isCancelled {
                do {
                    try await Task.sleep(nanoseconds: 30_000_000_000)
                } catch {
                    break
                }
                await store.refresh()
            }
        }
        .onChange(of: store.aircraft?.lastPositionTime) { _, _ in
            if store.followAircraft, let plane = store.aircraft {
                center(on: plane)
            }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "airplane.circle.fill")
                .font(.system(size: 41))
                .foregroundStyle(Color.cyan)
            VStack(alignment: .leading, spacing: 2) {
                Text("JACK'S")
                    .font(.system(size: 13, weight: .black, design: .rounded))
                    .tracking(3)
                    .foregroundStyle(.cyan)
                Text("FLIGHT TRACKER")
                    .font(.system(size: 23, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
            Spacer()
        }
        .accessibilityElement(children: .combine)
    }

    private var searchCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("FIND AN AIRPLANE")
                .font(.caption.bold())
                .tracking(1)
                .foregroundStyle(.white.opacity(0.65))
            HStack(spacing: 10) {
                TextField("Tail number (N233ND)", text: $store.tailInput)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .textContentType(.none)
                    .submitLabel(.search)
                    .focused($searchFocused)
                    .onSubmit { searchFocused = false; Task { await store.startSearch() } }
                    .padding(12)
                    .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 10))
                    .foregroundStyle(.white)
                    .accessibilityLabel("Aircraft tail number")
                Button {
                    searchFocused = false
                    Task { await store.startSearch() }
                } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.headline.bold())
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(.cyan)
                .disabled(store.isLoading || store.isFindingTestPlane)
                .accessibilityLabel("Search tail number")
            }
        }
        .padding(15)
        .background(cardBackground)
    }

    private var mapCard: some View {
        ZStack(alignment: .topTrailing) {
            Map(position: $mapCamera) {
                if store.trail.count > 1 {
                    MapPolyline(coordinates: store.trail)
                        .stroke(.cyan, lineWidth: 3)
                }
                if let plane = store.aircraft {
                    Annotation(plane.registration.isEmpty ? store.watchedTail : plane.registration, coordinate: plane.coordinate) {
                        Image(systemName: "airplane")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(12)
                            .background(.cyan, in: Circle())
                            .overlay(Circle().stroke(.white, lineWidth: 2))
                            .rotationEffect(.degrees((plane.headingDegrees ?? 0) - 90))
                            .shadow(radius: 6)
                            .accessibilityLabel("Tracked airplane location")
                    }
                }
            }
            .mapStyle(.standard(elevation: .flat))
            .frame(height: 345)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(alignment: .bottomLeading) {
                Text(store.aircraft?.isLive == true ? "POSITION REPORTED" : "LAST KNOWN / WAITING")
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.7)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(.black.opacity(0.75), in: Capsule())
                    .padding(10)
            }
            Button {
                store.followAircraft = true
                if let plane = store.aircraft { center(on: plane) }
            } label: {
                Image(systemName: "location.north.line.fill")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(width: 43, height: 43)
                    .background(Color.black.opacity(0.75), in: RoundedRectangle(cornerRadius: 12))
            }
            .padding(12)
            .accessibilityLabel("Center map on airplane")
        }
    }

    private var aircraftCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(store.watchedTail)
                        .font(.system(size: 27, weight: .bold, design: .rounded))
                    Text(store.aircraft?.model.isEmpty == false ? store.aircraft!.model : "Aircraft tracker")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.62))
                }
                Spacer()
                Text(store.aircraft?.isLive == true ? "LIVE DATA" : "NOT LIVE")
                    .font(.system(size: 10, weight: .black))
                    .tracking(1)
                    .foregroundStyle(store.aircraft?.isLive == true ? .green : .orange)
            }
            HStack(spacing: 8) {
                stat("ALTITUDE", altitude)
                stat("SPEED", speed)
                stat("HEADING", heading)
            }
            Text(store.status)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.78))
                .fixedSize(horizontal: false, vertical: true)
            if let plane = store.aircraft {
                Text("Last aircraft position: \(plane.lastPositionTime.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.53))
            }
        }
        .foregroundStyle(.white)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardBackground)
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(.white.opacity(0.55))
            Text(value)
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.75)
                .lineLimit(1)
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 12))
    }

    private var altitude: String {
        guard let plane = store.aircraft else { return "—" }
        if plane.isOnGround { return "GROUND" }
        return plane.altitudeFeet.map { "\($0.formatted()) ft" } ?? "—"
    }
    private var speed: String {
        store.aircraft?.groundSpeedKnots.map { "\($0) kt" } ?? "—"
    }
    private var heading: String {
        store.aircraft?.headingDegrees.map { "\(Int($0.rounded()))°" } ?? "—"
    }

    private var buttons: some View {
        VStack(spacing: 11) {
            Button {
                Task { await store.findTestPlane() }
            } label: {
                Label(store.isFindingTestPlane ? "Finding a test aircraft…" : "Find Flying Plane to Test", systemImage: "airplane.departure")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(red: 0.075, green: 0.50, blue: 0.63))
            .disabled(store.isLoading || store.isFindingTestPlane)
            Button {
                Task { await store.returnToJack() }
            } label: {
                Label("Back to Jack (N233ND)", systemImage: "arrow.uturn.backward")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(.white)
            .disabled(store.isLoading || store.isFindingTestPlane)
            Button {
                Task { await store.refresh() }
            } label: {
                Label(store.isLoading ? "Checking…" : "Refresh Position", systemImage: "arrow.clockwise")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.cyan)
            .disabled(store.isLoading || store.isFindingTestPlane)
        }
    }

    private var cardBackground: some ShapeStyle {
        Color(red: 0.075, green: 0.13, blue: 0.205)
    }

    private func center(on plane: TrackedAircraft) {
        withAnimation(.easeInOut(duration: 0.45)) {
            mapCamera = .region(
                MKCoordinateRegion(center: plane.coordinate, span: MKCoordinateSpan(latitudeDelta: 0.32, longitudeDelta: 0.32))
            )
        }
    }
}
