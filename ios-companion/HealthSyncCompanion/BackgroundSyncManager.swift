import Foundation
import HealthKit
import BackgroundTasks
import os.log

final class BackgroundSyncManager: NSObject {
    static let shared = BackgroundSyncManager()

    private let store = HKHealthStore()
    private let healthKitManager = HealthKitManager()
    private let logger = Logger(subsystem: "com.healthstitch.companion", category: "BackgroundSync")

    static let bgTaskIdentifier = "com.healthstitch.companion.refresh"
    private static let anchorKeyPrefix = "hk_anchor_"
    private static let lastBackgroundSyncKey = "last_background_sync_at"

    private let observedQuantityTypes: [HKQuantityTypeIdentifier] = [
        .heartRateVariabilitySDNN,
        .restingHeartRate,
        .activeEnergyBurned,
        .vo2Max,
        .respiratoryRate
    ]

    private let observedCategoryTypes: [HKCategoryTypeIdentifier] = [
        .sleepAnalysis
    ]

    private var backgroundSession: URLSession!
    private var backgroundCompletionHandler: (() -> Void)?

    private override init() {
        super.init()
        let config = URLSessionConfiguration.background(withIdentifier: "com.healthstitch.companion.upload")
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = true
        backgroundSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }

    // MARK: - Registration

    func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.bgTaskIdentifier,
            using: nil
        ) { [weak self] task in
            self?.handleAppRefresh(task: task as! BGAppRefreshTask)
        }
    }

    func enableBackgroundDelivery() {
        guard HKHealthStore.isHealthDataAvailable() else { return }

        for typeId in observedQuantityTypes {
            guard let type = HKObjectType.quantityType(forIdentifier: typeId) else { continue }
            store.enableBackgroundDelivery(for: type, frequency: .hourly) { success, error in
                if let error {
                    self.logger.error("Background delivery failed for \(typeId.rawValue): \(error.localizedDescription)")
                }
            }
        }

        for typeId in observedCategoryTypes {
            guard let type = HKObjectType.categoryType(forIdentifier: typeId) else { continue }
            store.enableBackgroundDelivery(for: type, frequency: .hourly) { success, error in
                if let error {
                    self.logger.error("Background delivery failed for \(typeId.rawValue): \(error.localizedDescription)")
                }
            }
        }

        store.enableBackgroundDelivery(for: HKObjectType.workoutType(), frequency: .hourly) { success, error in
            if let error {
                self.logger.error("Background delivery failed for workouts: \(error.localizedDescription)")
            }
        }
    }

    func startObserverQueries() {
        for typeId in observedQuantityTypes {
            guard let type = HKObjectType.quantityType(forIdentifier: typeId) else { continue }
            startObserver(for: type, metricKey: typeId.rawValue)
        }

        for typeId in observedCategoryTypes {
            guard let type = HKObjectType.categoryType(forIdentifier: typeId) else { continue }
            startObserver(for: type, metricKey: typeId.rawValue)
        }

        startObserver(for: HKObjectType.workoutType(), metricKey: "workouts")
    }

    // MARK: - Observer Queries

    private func startObserver(for type: HKSampleType, metricKey: String) {
        let query = HKObserverQuery(sampleType: type, predicate: nil) { [weak self] _, completionHandler, error in
            guard let self else {
                completionHandler()
                return
            }
            if let error {
                self.logger.error("Observer error for \(metricKey): \(error.localizedDescription)")
                completionHandler()
                return
            }

            self.logger.info("Observer fired for \(metricKey)")
            self.performAnchoredSync(for: type, metricKey: metricKey) {
                completionHandler()
            }
        }
        store.execute(query)
    }

    // MARK: - Anchored Object Queries

    private func performAnchoredSync(for type: HKSampleType, metricKey: String, completion: @escaping () -> Void) {
        let anchor = loadAnchor(for: metricKey)

        let query = HKAnchoredObjectQuery(
            type: type,
            predicate: nil,
            anchor: anchor,
            limit: HKObjectQueryNoLimit
        ) { [weak self] _, samples, _, newAnchor, error in
            guard let self else {
                completion()
                return
            }

            if let error {
                self.logger.error("Anchored query error for \(metricKey): \(error.localizedDescription)")
                completion()
                return
            }

            guard let samples, !samples.isEmpty else {
                if let newAnchor {
                    self.saveAnchor(newAnchor, for: metricKey)
                }
                completion()
                return
            }

            self.logger.info("Anchored query found \(samples.count) new samples for \(metricKey)")

            let payload = self.buildPayload(from: samples, type: type, metricKey: metricKey)
            self.uploadInBackground(payload: payload) { success in
                if success, let newAnchor {
                    self.saveAnchor(newAnchor, for: metricKey)
                    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: Self.lastBackgroundSyncKey)
                }
                completion()
            }
        }
        store.execute(query)
    }

    private func buildPayload(from samples: [HKSample], type: HKSampleType, metricKey: String) -> HealthPayload {
        var metrics: [MetricRecord] = []
        var sleepSessions: [SleepRecord] = []
        var workouts: [WorkoutRecord] = []

        if let quantityType = type as? HKQuantityType {
            let quantitySamples = samples.compactMap { $0 as? HKQuantitySample }
            metrics = quantitySamples.map { sample in
                let (unit, unitLabel, metricType) = unitInfo(for: quantityType)
                return MetricRecord(
                    metricType: metricType,
                    value: sample.quantity.doubleValue(for: unit),
                    unit: unitLabel,
                    recordedAt: sample.startDate,
                    externalId: sample.uuid.uuidString,
                    metadata: nil
                )
            }
        } else if type is HKCategoryType {
            let categorySamples = samples.compactMap { $0 as? HKCategorySample }
            sleepSessions = categorySamples.map { sample in
                SleepRecord(
                    sleepDate: ISO8601DateFormatter().string(from: sample.endDate).prefix(10).description,
                    startAt: sample.startDate,
                    endAt: sample.endDate,
                    totalDurationMs: Int(sample.endDate.timeIntervalSince(sample.startDate) * 1000),
                    slowWaveMs: nil,
                    remMs: nil,
                    lightMs: nil,
                    awakeMs: nil,
                    sleepPerformance: nil,
                    sleepNeedMs: nil,
                    sleepConsistency: nil,
                    sleepEfficiency: nil,
                    respiratoryRate: nil,
                    disturbanceCount: nil,
                    externalId: sample.uuid.uuidString,
                    metadata: ["value": sample.value]
                )
            }
        } else if type == HKObjectType.workoutType() {
            let workoutSamples = samples.compactMap { $0 as? HKWorkout }
            workouts = workoutSamples.map { workout in
                WorkoutRecord(
                    sportType: workout.workoutActivityType.displayName,
                    startAt: workout.startDate,
                    endAt: workout.endDate,
                    durationMs: Int(workout.duration * 1000),
                    avgHr: nil,
                    maxHr: nil,
                    strain: nil,
                    energyKj: nil,
                    energyKcal: workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()),
                    distanceM: workout.totalDistance?.doubleValue(for: .meter()),
                    hrZones: nil,
                    externalId: workout.uuid.uuidString,
                    metadata: nil
                )
            }
        }

        return HealthPayload(
            metrics: metrics,
            sleepSessions: sleepSessions,
            workouts: workouts,
            lastSyncAt: Date()
        )
    }

    private func unitInfo(for quantityType: HKQuantityType) -> (HKUnit, String, String) {
        switch quantityType.identifier {
        case HKQuantityTypeIdentifier.heartRateVariabilitySDNN.rawValue:
            return (HKUnit.secondUnit(with: .milli), "ms", "hrv_sdnn")
        case HKQuantityTypeIdentifier.restingHeartRate.rawValue:
            return (HKUnit.count().unitDivided(by: .minute()), "bpm", "resting_hr")
        case HKQuantityTypeIdentifier.activeEnergyBurned.rawValue:
            return (HKUnit.kilocalorie(), "kcal", "active_energy")
        case HKQuantityTypeIdentifier.vo2Max.rawValue:
            return (HKUnit(from: "ml/kg*min"), "ml_kg_min", "vo2_max")
        case HKQuantityTypeIdentifier.respiratoryRate.rawValue:
            return (HKUnit.count().unitDivided(by: .minute()), "breaths_per_min", "respiratory_rate")
        default:
            return (HKUnit.count(), "count", "unknown")
        }
    }

    // MARK: - Background Upload

    private func uploadInBackground(payload: HealthPayload, completion: @escaping (Bool) -> Void) {
        guard let backendURL = backendURL, let token = authToken else {
            logger.error("No backend URL or auth token configured")
            completion(false)
            return
        }

        let url = backendURL.appendingPathComponent("api/apple/ingest")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        guard let data = try? encoder.encode(payload) else {
            logger.error("Failed to encode payload")
            completion(false)
            return
        }

        // For background upload, write to a file first
        let tempFile = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString + ".json")
        do {
            try data.write(to: tempFile)
        } catch {
            logger.error("Failed to write upload file: \(error.localizedDescription)")
            completion(false)
            return
        }

        let task = backgroundSession.uploadTask(with: request, fromFile: tempFile)
        task.resume()
        completion(true)
    }

    // MARK: - BGAppRefreshTask Fallback

    private func handleAppRefresh(task: BGAppRefreshTask) {
        scheduleNextRefresh()

        let lastSync = UserDefaults.standard.double(forKey: Self.lastBackgroundSyncKey)
        let twoHoursAgo = Date().timeIntervalSince1970 - (2 * 60 * 60)

        guard lastSync < twoHoursAgo else {
            logger.info("Background refresh skipped — last sync was recent")
            task.setTaskCompleted(success: true)
            return
        }

        logger.info("Background refresh triggered — last sync over 2 hours ago")

        Task {
            do {
                let payload = try await healthKitManager.fetchUpdates(since: Date(timeIntervalSince1970: lastSync))
                let hasData = !payload.metrics.isEmpty || !payload.sleepSessions.isEmpty || !payload.workouts.isEmpty
                if hasData {
                    uploadInBackground(payload: payload) { _ in }
                }
                UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: Self.lastBackgroundSyncKey)
                task.setTaskCompleted(success: true)
            } catch {
                self.logger.error("Background refresh failed: \(error.localizedDescription)")
                task.setTaskCompleted(success: false)
            }
        }

        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
    }

    func scheduleNextRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.bgTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 2 * 60 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            logger.error("Failed to schedule background refresh: \(error.localizedDescription)")
        }
    }

    // MARK: - Anchor Persistence

    private func loadAnchor(for metricKey: String) -> HKQueryAnchor? {
        let key = Self.anchorKeyPrefix + metricKey
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data)
    }

    private func saveAnchor(_ anchor: HKQueryAnchor, for metricKey: String) {
        let key = Self.anchorKeyPrefix + metricKey
        guard let data = try? NSKeyedArchiver.archivedData(withRootObject: anchor, requiringSecureCoding: true) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    // MARK: - Configuration

    private var backendURL: URL? {
        guard let urlString = UserDefaults.standard.string(forKey: "backend_url"),
              !urlString.isEmpty else { return nil }
        return URL(string: urlString)
    }

    private var authToken: String? {
        KeychainHelper.load(key: "jwt_token")
    }

    // MARK: - Background Session Handling

    func handleBackgroundSessionEvents(completionHandler: @escaping () -> Void) {
        backgroundCompletionHandler = completionHandler
    }
}

// MARK: - URLSessionDelegate

extension BackgroundSyncManager: URLSessionDelegate, URLSessionDataDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error {
            logger.error("Background upload failed: \(error.localizedDescription)")
        } else {
            logger.info("Background upload completed successfully")
        }
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async { [weak self] in
            self?.backgroundCompletionHandler?()
            self?.backgroundCompletionHandler = nil
        }
    }
}

// MARK: - HKWorkoutActivityType extension for BackgroundSyncManager

private extension HKWorkoutActivityType {
    var displayName: String {
        switch self {
        case .running: return "Running"
        case .walking: return "Walking"
        case .cycling: return "Cycling"
        case .traditionalStrengthTraining: return "Strength Training"
        case .highIntensityIntervalTraining: return "HIIT"
        default: return "Workout"
        }
    }
}
