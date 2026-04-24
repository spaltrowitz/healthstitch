const fs = require('fs');
const path = require('path');
const sax = require('sax');
const { execSync } = require('child_process');
const { ingestMetricBatch, ingestSleepBatch, ingestWorkoutBatch } = require('./ingestService');

const BATCH_SIZE = 500;

const HK_METRIC_MAP = {
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': { type: 'hrv_sdnn', unit: 'ms' },
  'HKQuantityTypeIdentifierRestingHeartRate': { type: 'resting_hr', unit: 'bpm' },
  'HKQuantityTypeIdentifierOxygenSaturation': { type: 'spo2', unit: 'percent' },
  'HKQuantityTypeIdentifierRespiratoryRate': { type: 'respiratory_rate', unit: 'breaths_per_min' }
};

const ACTIVE_ENERGY_TYPE = 'HKQuantityTypeIdentifierActiveEnergyBurned';

const SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis';

const SLEEP_STAGE_VALUES = {
  'HKCategoryValueSleepAnalysisAsleepDeep': 'deep',
  'HKCategoryValueSleepAnalysisAsleepREM': 'rem',
  'HKCategoryValueSleepAnalysisAsleepCore': 'light',
  'HKCategoryValueSleepAnalysisAsleepUnspecified': 'light',
  'HKCategoryValueSleepAnalysisAwake': 'awake',
  'HKCategoryValueSleepAnalysisInBed': 'inbed'
};

const HK_WORKOUT_PREFIX = 'HKWorkoutActivityType';

function toIso(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isAppleWatchSource(attrs) {
  const source = (attrs.sourceName || '').toLowerCase().replace(/\u00a0/g, ' ');
  return source.includes('apple watch');
}

function durationMs(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  return new Date(endIso).getTime() - new Date(startIso).getTime();
}

function aggregateSleepSessions(sleepEntries) {
  const byDate = {};

  for (const entry of sleepEntries) {
    const endDate = entry.endIso.slice(0, 10);
    if (!byDate[endDate]) {
      byDate[endDate] = { entries: [], minStart: entry.startIso, maxEnd: entry.endIso };
    }
    byDate[endDate].entries.push(entry);
    if (entry.startIso < byDate[endDate].minStart) byDate[endDate].minStart = entry.startIso;
    if (entry.endIso > byDate[endDate].maxEnd) byDate[endDate].maxEnd = entry.endIso;
  }

  const sessions = [];
  for (const [date, group] of Object.entries(byDate)) {
    let deep = 0, rem = 0, light = 0, awake = 0, total = 0;

    for (const e of group.entries) {
      const ms = durationMs(e.startIso, e.endIso);
      if (e.stage === 'deep') deep += ms;
      else if (e.stage === 'rem') rem += ms;
      else if (e.stage === 'light') light += ms;
      else if (e.stage === 'awake') awake += ms;
      if (e.stage !== 'inbed') total += ms;
    }

    if (total === 0) total = durationMs(group.minStart, group.maxEnd);

    sessions.push({
      sleep_date: date,
      start_at: group.minStart,
      end_at: group.maxEnd,
      total_duration_ms: total,
      slow_wave_ms: deep || null,
      rem_ms: rem || null,
      light_ms: light || null,
      awake_ms: awake || null,
      external_id: `apple_export:sleep:${date}`
    });
  }

  return sessions;
}

function parseAppleHealthExport(userId, filePath) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filePath).toLowerCase();
    let xmlPath = filePath;
    let extractDir = null;

    if (ext === '.zip') {
      extractDir = filePath + '_extracted';
      fs.mkdirSync(extractDir, { recursive: true });
      execSync(`unzip -o -q "${filePath}" -d "${extractDir}"`);

      const candidates = [];
      function findXml(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) findXml(full);
          else if (entry.name.toLowerCase() === 'export.xml') candidates.push(full);
        }
      }
      findXml(extractDir);

      if (candidates.length === 0) {
        if (extractDir) fs.rmSync(extractDir, { recursive: true, force: true });
        return reject(new Error('No export.xml found in ZIP'));
      }
      xmlPath = candidates[0];
    }

    const counts = { metrics: 0, sleeps: 0, workouts: 0 };
    let metricBatch = [];
    let workoutBatch = [];
    const sleepEntries = [];
    const dailyActiveEnergy = {};

    function flushMetrics() {
      if (metricBatch.length === 0) return;
      ingestMetricBatch(userId, 'apple_watch', metricBatch);
      counts.metrics += metricBatch.length;
      metricBatch = [];
    }

    function flushWorkouts() {
      if (workoutBatch.length === 0) return;
      ingestWorkoutBatch(userId, 'apple_watch', workoutBatch);
      counts.workouts += workoutBatch.length;
      workoutBatch = [];
    }

    const parser = sax.createStream(true, { trim: true });

    parser.on('opentag', (node) => {
      const attrs = node.attributes;

      if (node.name === 'Record') {
        if (!isAppleWatchSource(attrs)) return;

        const hkType = attrs.type;
        const mapping = HK_METRIC_MAP[hkType];

        if (mapping) {
          const value = Number(attrs.value);
          const recordedAt = toIso(attrs.startDate || attrs.endDate);
          if (Number.isFinite(value) && recordedAt) {
            metricBatch.push({
              metric_type: mapping.type,
              value,
              unit: mapping.unit,
              recorded_at: recordedAt,
              external_id: `apple_export:${mapping.type}:${recordedAt}`
            });
            if (metricBatch.length >= BATCH_SIZE) flushMetrics();
          }
        } else if (hkType === ACTIVE_ENERGY_TYPE) {
          const value = Number(attrs.value);
          const recordedAt = toIso(attrs.startDate || attrs.endDate);
          if (Number.isFinite(value) && recordedAt) {
            const day = recordedAt.slice(0, 10);
            dailyActiveEnergy[day] = (dailyActiveEnergy[day] || 0) + value;
          }
        } else if (hkType === SLEEP_TYPE) {
          const startIso = toIso(attrs.startDate);
          const endIso = toIso(attrs.endDate);
          const stage = SLEEP_STAGE_VALUES[attrs.value] || 'light';
          if (startIso && endIso) {
            sleepEntries.push({ startIso, endIso, stage });
          }
        }
      } else if (node.name === 'Workout') {
        if (!isAppleWatchSource(attrs)) return;

        const activityType = attrs.workoutActivityType || '';
        const sportType = activityType.replace(HK_WORKOUT_PREFIX, '') || 'Workout';
        const startAt = toIso(attrs.startDate);
        const endAt = toIso(attrs.endDate);
        if (!startAt || !endAt) return;

        const dur = Number(attrs.duration);
        const durUnit = (attrs.durationUnit || '').toLowerCase();
        let durationMs;
        if (Number.isFinite(dur)) {
          durationMs = durUnit.includes('hour') ? dur * 3600000 : dur * 60000;
        } else {
          durationMs = new Date(endAt).getTime() - new Date(startAt).getTime();
        }

        const totalEnergy = Number(attrs.totalEnergyBurned);
        const distance = Number(attrs.totalDistance);

        workoutBatch.push({
          sport_type: sportType,
          start_at: startAt,
          end_at: endAt,
          duration_ms: Math.round(durationMs),
          energy_kcal: Number.isFinite(totalEnergy) ? totalEnergy : null,
          distance_m: Number.isFinite(distance) ? distance * 1000 : null,
          external_id: `apple_export:workout:${startAt}`
        });
        if (workoutBatch.length >= BATCH_SIZE) flushWorkouts();
      }
    });

    parser.on('end', () => {
      flushMetrics();
      flushWorkouts();

      // Flush aggregated daily active energy as one record per day
      const energyRecords = Object.entries(dailyActiveEnergy).map(([day, total]) => ({
        metric_type: 'active_energy',
        value: Math.round(total * 100) / 100,
        unit: 'kcal',
        recorded_at: `${day}T23:59:59.000Z`,
        external_id: `apple_export:active_energy:${day}`
      }));
      if (energyRecords.length > 0) {
        ingestMetricBatch(userId, 'apple_watch', energyRecords);
        counts.metrics += energyRecords.length;
      }

      const sessions = aggregateSleepSessions(sleepEntries);
      if (sessions.length > 0) {
        ingestSleepBatch(userId, 'apple_watch', sessions);
        counts.sleeps = sessions.length;
      }

      if (extractDir) fs.rmSync(extractDir, { recursive: true, force: true });
      resolve(counts);
    });

    parser.on('error', (err) => {
      if (extractDir) fs.rmSync(extractDir, { recursive: true, force: true });
      reject(new Error(`XML parse error: ${err.message}`));
    });

    fs.createReadStream(xmlPath).pipe(parser);
  });
}

module.exports = { parseAppleHealthExport };
