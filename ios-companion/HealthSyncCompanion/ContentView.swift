import SwiftUI

struct ContentView: View {
    @AppStorage("backend_url") private var backendURLString = "http://localhost:3000/"
    @AppStorage("last_sync_at") private var lastSyncAtString = ""

    @State private var jwtToken: String = KeychainHelper.load(key: "jwt_token") ?? ""
    @State private var status = "Not synced yet"
    @State private var isSyncing = false

    private let healthKitManager = HealthKitManager()
    private let syncService = SyncService()

    var body: some View {
        NavigationStack {
            Form {
                Section("Health Sync") {
                    Button("Request HealthKit Permissions") {
                        Task { await requestPermissions() }
                    }

                    Button("Sync Now") {
                        Task { await syncNow() }
                    }
                    .disabled(isSyncing)

                    Text("Status: \(status)")
                    Text("Last sync: \(lastSyncAtString.isEmpty ? "Never" : lastSyncAtString)")
                    Text("Background: Active")
                        .foregroundColor(.green)
                }

                Section("Backend") {
                    TextField("Backend URL", text: $backendURLString)
                    SecureField("JWT token", text: $jwtToken)
                        .onChange(of: jwtToken) { _, newValue in
                            KeychainHelper.save(key: "jwt_token", value: newValue)
                        }
                }
            }
            .navigationTitle("Health Sync Companion")
        }
    }

    @MainActor
    private func requestPermissions() async {
        do {
            try await healthKitManager.requestPermissions()
            status = "Permissions granted"
        } catch {
            status = "Permission error: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func syncNow() async {
        guard let backendURL = URL(string: backendURLString), !jwtToken.isEmpty else {
            status = "Set backend URL and JWT token first"
            return
        }

        isSyncing = true
        status = "Syncing..."

        defer { isSyncing = false }

        do {
            let since = ISO8601DateFormatter().date(from: lastSyncAtString)
            let payload = try await healthKitManager.fetchUpdates(since: since)
            try await syncService.uploadBatches(payload: payload, backendURL: backendURL, token: jwtToken)

            let now = ISO8601DateFormatter().string(from: Date())
            lastSyncAtString = now
            status = "Sync complete"
        } catch {
            status = "Sync failed: \(error.localizedDescription)"
        }
    }
}
