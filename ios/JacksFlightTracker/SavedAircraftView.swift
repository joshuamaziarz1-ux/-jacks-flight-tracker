import SwiftUI

struct SavedAircraftView: View {
    @ObservedObject var tracker: TrackingStore
    @StateObject private var library = SavedAircraftLibrary()
    @State private var expanded = true
    @State private var selectedCategory = "all"
    @State private var saveToCategory = "sweet-aviation"
    @State private var newCategoryName = ""
    @State private var message = ""
    @State private var editingCategoryId: String?
    @State private var editingCategoryName = ""
    @State private var editingPlaneTail: String?
    @State private var editingPlaneNote = ""

    private var visible: [SavedAircraft] {
        library.aircraft
            .filter { selectedCategory == "all" || $0.categoryId == selectedCategory }
            .sorted { $0.tail < $1.tail }
    }

    var body: some View {
        DisclosureGroup(isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: 13) {
                Text("Your saved airplanes stay on this iPhone. The Sweet Aviation list includes N233ND and N278DC.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.58))

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        categoryChip("All (\(library.count))", id: "all")
                        ForEach(library.categories) { category in
                            let count = library.aircraft.filter { $0.categoryId == category.id }.count
                            categoryChip("\(category.name) (\(count))", id: category.id)
                        }
                    }
                }

                ForEach(visible) { plane in
                    planeRow(plane)
                }
                if visible.isEmpty {
                    Text("No airplanes in this category yet.")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                }

                HStack {
                    Menu {
                        ForEach(library.categories) { category in
                            Button(category.name) { saveToCategory = category.id }
                        }
                    } label: {
                        Label(library.categories.first(where: { $0.id == saveToCategory })?.name ?? "Category",
                              systemImage: "folder")
                            .font(.caption)
                    }
                    Spacer()
                    Button {
                        if library.saveAircraft(tracker.tailInput, categoryId: saveToCategory) {
                            selectedCategory = saveToCategory
                            message = "Saved \(tracker.tailInput.uppercased())."
                        } else {
                            message = "Enter a valid tail number."
                        }
                    } label: {
                        Label("Save plane", systemImage: "plus.circle.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.cyan)
                }

                HStack {
                    TextField("New category", text: $newCategoryName)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.words)
                    Button {
                        if let id = library.createCategory(newCategoryName) {
                            selectedCategory = id
                            saveToCategory = id
                            newCategoryName = ""
                            message = "Category created."
                        } else { message = "Enter a category name." }
                    } label: {
                        Image(systemName: "folder.badge.plus")
                    }
                    .buttonStyle(.bordered)
                    .tint(.cyan)
                    .accessibilityLabel("Create category")
                }
                if selectedCategory != "all",
                   let category = library.categories.first(where: { $0.id == selectedCategory }) {
                    HStack {
                        Text("Category: " + category.name)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.65))
                        Spacer()
                        Button("Rename") {
                            editingCategoryId = category.id
                            editingCategoryName = category.name
                        }
                        Button("Delete") {
                            if library.removeCategory(category.id) {
                                selectedCategory = "all"
                                saveToCategory = library.categories.first?.id ?? ""
                                message = "Category deleted."
                            } else {
                                message = "Move or remove its planes first."
                            }
                        }
                    }
                    .font(.caption)
                }
                if !message.isEmpty {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(.cyan)
                }
            }
            .padding(.top, 14)
        } label: {
            Label("My Aircraft · \(library.count)", systemImage: "folder.fill")
                .font(.headline)
                .foregroundStyle(.white)
        }
        .tint(.cyan)
        .padding(16)
        .background(Color(red: 0.075, green: 0.13, blue: 0.205), in: RoundedRectangle(cornerRadius: 17))
        .alert("Rename category", isPresented: Binding(
            get: { editingCategoryId != nil },
            set: { if !$0 { editingCategoryId = nil } }
        )) {
            TextField("Category", text: $editingCategoryName)
            Button("Save") {
                if let id = editingCategoryId,
                   !library.renameCategory(id, to: editingCategoryName) {
                    message = "That category name is invalid or already in use."
                }
                editingCategoryId = nil
            }
            Button("Cancel", role: .cancel) { editingCategoryId = nil }
        }
        .alert("Edit aircraft note", isPresented: Binding(
            get: { editingPlaneTail != nil },
            set: { if !$0 { editingPlaneTail = nil } }
        )) {
            TextField("Note", text: $editingPlaneNote)
            Button("Save") {
                if let tail = editingPlaneTail {
                    library.changeNote(for: tail, to: editingPlaneNote)
                }
                editingPlaneTail = nil
            }
            Button("Cancel", role: .cancel) { editingPlaneTail = nil }
        }
    }

    private func categoryChip(_ name: String, id: String) -> some View {
        Button(name) {
            selectedCategory = id
            if id != "all" { saveToCategory = id }
        }
        .font(.caption.bold())
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(selectedCategory == id ? Color.cyan : Color.white.opacity(0.08), in: Capsule())
        .foregroundStyle(selectedCategory == id ? Color.black : Color.white)
        .buttonStyle(.plain)
    }

    private func planeRow(_ plane: SavedAircraft) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(plane.tail)
                        .font(.headline.monospaced())
                        .foregroundStyle(.white)
                    Text(plane.note.isEmpty ? "Saved aircraft" : plane.note)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                }
                Spacer()
                Button("Track") {
                    tracker.tailInput = plane.tail
                    Task { await tracker.startSearch() }
                }
                .buttonStyle(.borderedProminent)
                .tint(.cyan)
            }
            HStack {
                Menu {
                    ForEach(library.categories) { category in
                        Button(category.name) { _ = library.saveAircraft(plane.tail, categoryId: category.id) }
                    }
                } label: {
                    Label("Move to category", systemImage: "folder")
                }
                Spacer()
                Button("Note") {
                    editingPlaneTail = plane.tail
                    editingPlaneNote = plane.note
                }
                Button("Remove", role: .destructive) {
                    library.removeAircraft(plane.tail)
                    message = plane.tail + " removed."
                }
            }
            .font(.caption)
            .foregroundStyle(.cyan)
        }
        .padding(11)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 11))
    }
}
