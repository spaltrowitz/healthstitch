import Foundation

struct MetricRecord: Codable {
    let metricType: String
    let value: Double
    let unit: String
    let recordedAt: Date
    let externalId: String?
    let metadata: [String: Int]?

    enum CodingKeys: String, CodingKey {
        case metricType = "metric_type"
        case value
        case unit
        case recordedAt = "recorded_at"
        case externalId = "external_id"
        case metadata
    }
}

struct SleepRecord: Codable {
    let sleepDate: String
    let startAt: Date
    let endAt: Date
    let totalDurationMs: Int
    let slowWaveMs: Int?
    let remMs: Int?
    let lightMs: Int?
    let awakeMs: Int?
    let sleepPerformance: Double?
    let sleepNeedMs: Int?
    let sleepConsistency: Double?
    let sleepEfficiency: Double?
    let respiratoryRate: Double?
    let disturbanceCount: Int?
    let externalId: String?
    let metadata: [String: Int]?

    enum CodingKeys: String, CodingKey {
        case sleepDate = "sleep_date"
        case startAt = "start_at"
        case endAt = "end_at"
        case totalDurationMs = "total_duration_ms"
        case slowWaveMs = "slow_wave_ms"
        case remMs = "rem_ms"
        case lightMs = "light_ms"
        case awakeMs = "awake_ms"
        case sleepPerformance = "sleep_performance"
        case sleepNeedMs = "sleep_need_ms"
        case sleepConsistency = "sleep_consistency"
        case sleepEfficiency = "sleep_efficiency"
        case respiratoryRate = "respiratory_rate"
        case disturbanceCount = "disturbance_count"
        case externalId = "external_id"
        case metadata
    }
}

struct WorkoutRecord: Codable {
    let sportType: String
    let startAt: Date
    let endAt: Date
    let durationMs: Int
    let avgHr: Double?
    let maxHr: Double?
    let strain: Double?
    let energyKj: Double?
    let energyKcal: Double?
    let distanceM: Double?
    let hrZones: [String: Int]?
    let externalId: String?
    let metadata: [String: Int]?

    enum CodingKeys: String, CodingKey {
        case sportType = "sport_type"
        case startAt = "start_at"
        case endAt = "end_at"
        case durationMs = "duration_ms"
        case avgHr = "avg_hr"
        case maxHr = "max_hr"
        case strain
        case energyKj = "energy_kj"
        case energyKcal = "energy_kcal"
        case distanceM = "distance_m"
        case hrZones = "hr_zones"
        case externalId = "external_id"
        case metadata
    }
}

struct HealthPayload: Codable {
    let metrics: [MetricRecord]
    let sleepSessions: [SleepRecord]
    let workouts: [WorkoutRecord]
    let lastSyncAt: Date

    enum CodingKeys: String, CodingKey {
        case metrics
        case sleepSessions = "sleep_sessions"
        case workouts
        case lastSyncAt = "last_sync_at"
    }
}

final class SyncService {
    func uploadBatches(payload: HealthPayload, backendURL: URL, token: String, batchSize: Int = 500) async throws {
        let metricChunks = payload.metrics.chunked(into: batchSize)
        let sleepChunks = payload.sleepSessions.chunked(into: batchSize)
        let workoutChunks = payload.workouts.chunked(into: batchSize)
        let maxCount = max(metricChunks.count, sleepChunks.count, workoutChunks.count)

        for idx in 0..<maxCount {
            let body = HealthPayload(
                metrics: metricChunks[safe: idx] ?? [],
                sleepSessions: sleepChunks[safe: idx] ?? [],
                workouts: workoutChunks[safe: idx] ?? [],
                lastSyncAt: payload.lastSyncAt
            )
            try await upload(payload: body, backendURL: backendURL, token: token)
        }
    }

    private func upload(payload: HealthPayload, backendURL: URL, token: String) async throws {
        var request = URLRequest(url: backendURL.appendingPathComponent("api/apple/ingest"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(payload)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "HealthSync", code: 2, userInfo: [NSLocalizedDescriptionKey: "Upload failed"]) }
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map { index in
            Array(self[index..<Swift.min(index + size, count)])
        }
    }

    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
