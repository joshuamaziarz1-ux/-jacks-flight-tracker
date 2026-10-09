import Foundation
import Combine

struct SavedAircraftCategory: Codable, Identifiable, Equatable {
    var id: String
    var name: String
}
struct SavedAircraft: Codable, Identifiable, Equatable {
    var tail: String
    var categoryId: String
    var note: String
    var id: String { tail }
}
private struct SavedAircraftArchive: Codable {
    var categories: [SavedAircraftCategory]
    var aircraft: [SavedAircraft]
}

/// Saved only on this iPhone (UserDefaults). No cloud account is required.
@MainActor
final class SavedAircraftLibrary: ObservableObject {
    private let defaultsKey = "jack.saved.aircraft.v1"
    @Published private(set) var categories: [SavedAircraftCategory] = []
    @Published private(set) var aircraft: [SavedAircraft] = []

    init() {
        if let data = UserDefaults.standard.data(forKey: defaultsKey),
           let archive = try? JSONDecoder().decode(SavedAircraftArchive.self, from: data),
           !archive.categories.isEmpty {
            categories = archive.categories
            aircraft = archive.aircraft
        } else {
            categories = [SavedAircraftCategory(id: "sweet-aviation", name: "Sweet Aviation")]
            aircraft = [
                SavedAircraft(tail: "N233ND", categoryId: "sweet-aviation", note: "Jack’s training airplane"),
                SavedAircraft(tail: "N278DC", categoryId: "sweet-aviation", note: "Sweet Aviation DA20-C1")
            ]
            save()
        }
    }

    var count: Int { aircraft.count }

    func createCategory(_ name: String) -> String? {
        let clean = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(36))
        guard !clean.isEmpty else { return nil }
        if let existing = categories.first(where: { $0.name.localizedCaseInsensitiveCompare(clean) == .orderedSame }) {
            return existing.id
        }
        let id = UUID().uuidString
        categories.append(SavedAircraftCategory(id: id, name: clean))
        save()
        return id
    }

    func renameCategory(_ id: String, to name: String) -> Bool {
        let clean = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(36))
        guard !clean.isEmpty,
              !categories.contains(where: { $0.id != id && $0.name.localizedCaseInsensitiveCompare(clean) == .orderedSame }),
              let index = categories.firstIndex(where: { $0.id == id }) else { return false }
        categories[index].name = clean
        save()
        return true
    }

    func removeCategory(_ id: String) -> Bool {
        guard !aircraft.contains(where: { $0.categoryId == id }), categories.count > 1 else { return false }
        categories.removeAll { $0.id == id }
        save()
        return true
    }

    func saveAircraft(_ text: String, categoryId: String) -> Bool {
        let tail = text.uppercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-")
        guard (2...12).contains(tail.count), tail.unicodeScalars.allSatisfy({ allowed.contains($0) }),
              categories.contains(where: { $0.id == categoryId }) else { return false }
        if let index = aircraft.firstIndex(where: { $0.tail == tail }) {
            aircraft[index].categoryId = categoryId
        } else {
            aircraft.append(SavedAircraft(tail: tail, categoryId: categoryId, note: ""))
        }
        save()
        return true
    }

    func changeNote(for tail: String, to note: String) {
        guard let index = aircraft.firstIndex(where: { $0.tail == tail }) else { return }
        aircraft[index].note = String(note.prefix(70))
        save()
    }

    func removeAircraft(_ tail: String) {
        aircraft.removeAll { $0.tail == tail }
        save()
    }

    private func save() {
        let payload = SavedAircraftArchive(categories: categories, aircraft: aircraft)
        if let data = try? JSONEncoder().encode(payload) {
            UserDefaults.standard.set(data, forKey: defaultsKey)
        }
    }
}
