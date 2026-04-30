import SwiftUI
import UIKit

@main
struct HealthSyncCompanionApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let syncManager = BackgroundSyncManager.shared
        syncManager.registerBackgroundTasks()
        syncManager.enableBackgroundDelivery()
        syncManager.startObserverQueries()
        syncManager.scheduleNextRefresh()

        migrateTokenToKeychain()
        return true
    }

    func application(
        _ application: UIApplication,
        handleEventsForBackgroundURLSession identifier: String,
        completionHandler: @escaping () -> Void
    ) {
        BackgroundSyncManager.shared.handleBackgroundSessionEvents(completionHandler: completionHandler)
    }

    private func migrateTokenToKeychain() {
        let key = "jwt_token"
        if let existing = UserDefaults.standard.string(forKey: key), !existing.isEmpty {
            if KeychainHelper.load(key: key) == nil {
                KeychainHelper.save(key: key, value: existing)
            }
            UserDefaults.standard.removeObject(forKey: key)
        }
    }
}
