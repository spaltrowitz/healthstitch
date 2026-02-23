import Foundation
import HealthKit

final class HealthKitManager {
    private let store = HKHealthStore()

    private let quantityTypes: [HKQuantityTypeIdentifier] = [
        .heartRateVariabilitySDNN,
        .restingHeartRate,
        .activeEnergyBurned,
        .vo2Max,
        .respiratoryRate
    ]

    private let categoryTypes: [HKCategoryTypeIdentifier] = [
        .sleepAnalysis
    ]

    func requestPermissions() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw NSError(domain: "HealthSync", code: 1, userInfo: [NSLocalizedDescriptionKey: "Health data unavailable on this device"]) }

        let readTypes: Set<HKObjectType> = Set(quantityTypes.compactMap { HKObjectType.quantityType(forIdentifier: $0) })
            .union(Set(categoryTypes.compactMap { HKObjectType.categoryType(forIdentifier: $0) }))
            .union([HKObjectType.workoutType()])

        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    func fetchUpdates(since: Date?) async throws -> HealthPayload {
        async let metrics = fetchQuantityMetrics(since: since)
        async let sleep = fetchSleepSessions(since: since)
        async let workouts = fetchWorkouts(since: since)

        return try await HealthPayload(
            metrics: metrics,
            sleepSessions: sleep,
            workouts: workouts,
            lastSyncAt: Date()
        )
    }

    private func fetchQuantityMetrics(since: Date?) async throws -> [MetricRecord] {
        var all: [MetricRecord] = []
        for typeId in quantityTypes {
            guard let type = HKObjectType.quantityType(forIdentifier: typeId) else { continue }
            let samples = try await fetchQuantitySamples(type: type, since: since)
            all.append(contentsOf: samples.map { sample in
                let unit: HKUnit
                switch typeId {
                case .heartRateVariabilitySDNN:
                    unit = HKUnit.secondUnit(with: .milli)
                case .restingHeartRate:
                    unit = HKUnit.count().unitDivided(by: .minute())
                case .activeEnergyBurned:
                    unit = HKUnit.kilocalorie()
                case .vo2Max:
                    unit = HKUnit(from: "ml/kg*min")
                case .respiratoryRate:
                    unit = HKUnit.count().unitDivided(by: .minute())
                default:
                    unit = HKUnit.count()
                }

                return MetricRecord(
                    metricType: metricType(for: typeId),
                    value: sample.quantity.doubleValue(for: unit),
                    unit: unitLabel(for: typeId),
                    recordedAt: sample.startDate,
                    externalId: sample.uuid.uuidString,
                    metadata: nil
                )
            })
        }

        return all
    }

    private func fetchSleepSessions(since: Date?) async throws -> [SleepRecord] {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return [] }
        let predicate = since.map { HKQuery.predicateForSamples(withStart: $0, end: nil, options: .strictStartDate) }

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let records: [SleepRecord] = (samples as? [HKCategorySample] ?? []).map { sample in
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
                continuation.resume(returning: records)
            }

            self.store.execute(query)
        }
    }

    private func fetchWorkouts(since: Date?) async throws -> [WorkoutRecord] {
        let predicate = since.map { HKQuery.predicateForSamples(withStart: $0, end: nil, options: .strictStartDate) }

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let records: [WorkoutRecord] = (samples as? [HKWorkout] ?? []).map { workout in
                    WorkoutRecord(
                        sportType: workout.workoutActivityType.name,
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
                continuation.resume(returning: records)
            }

            self.store.execute(query)
        }
    }

    private func fetchQuantitySamples(type: HKQuantityType, since: Date?) async throws -> [HKQuantitySample] {
        let predicate = since.map { HKQuery.predicateForSamples(withStart: $0, end: nil, options: .strictStartDate) }

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: samples as? [HKQuantitySample] ?? [])
            }
            self.store.execute(query)
        }
    }

    private func metricType(for id: HKQuantityTypeIdentifier) -> String {
        switch id {
        case .heartRateVariabilitySDNN: return "hrv_sdnn"
        case .restingHeartRate: return "resting_hr"
        case .activeEnergyBurned: return "active_energy"
        case .vo2Max: return "vo2_max"
        case .respiratoryRate: return "respiratory_rate"
        default: return "unknown"
        }
    }

    private func unitLabel(for id: HKQuantityTypeIdentifier) -> String {
        switch id {
        case .heartRateVariabilitySDNN: return "ms"
        case .restingHeartRate: return "bpm"
        case .activeEnergyBurned: return "kcal"
        case .vo2Max: return "ml_kg_min"
        case .respiratoryRate: return "breaths_per_min"
        default: return "count"
        }
    }
}

private extension HKWorkoutActivityType {
    var name: String {
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
