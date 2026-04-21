const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { execSync } = require('child_process');
const { ingestMetricBatch, ingestSleepBatch, ingestWorkoutBatch } = require('./ingestService');

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function msFromHours(value) {
  const n = num(value);
  return n != null ? Math.round(n * 3600000) : null;
}

function msFromMinutes(value) {
  const n = num(value);
  return n != null ? Math.round(n * 60000) : null;
}

function findColumn(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const c of candidates) {
    const target = c.toLowerCase().replace(/[^a-z0-9]/g, '');
    const idx = lower.indexOf(target);
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function col(row, headers, candidates) {
  const key = findColumn(headers, candidates);
  return key ? row[key] : undefined;
}

function parseCyclesCsv(userId, content) {
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
  if (records.length === 0) return { metrics: 0 };

  const headers = Object.keys(records[0]);
  const metrics = [];

  for (const row of records) {
    const recordedAt = toIso(col(row, headers, ['start', 'cycle_start', 'created_at', 'date']));
    if (!recordedAt) continue;

    const mappings = [
      { type: 'recovery_score', value: num(col(row, headers, ['recovery_score', 'recovery'])), unit: 'percent' },
      { type: 'hrv_rmssd', value: num(col(row, headers, ['hrv_rmssd', 'hrv', 'hrv_rmssd_milli'])), unit: 'ms' },
      { type: 'resting_hr', value: num(col(row, headers, ['resting_heart_rate', 'resting_hr', 'rhr'])), unit: 'bpm' },
      { type: 'daily_strain', value: num(col(row, headers, ['strain', 'day_strain', 'daily_strain'])), unit: 'score' },
      { type: 'energy_kj', value: num(col(row, headers, ['kilojoules', 'energy_burned', 'kilojoule'])), unit: 'kj' },
      { type: 'max_hr', value: num(col(row, headers, ['max_heart_rate', 'max_hr'])), unit: 'bpm' },
      { type: 'avg_hr', value: num(col(row, headers, ['average_heart_rate', 'avg_hr', 'avg_heart_rate'])), unit: 'bpm' },
      { type: 'spo2', value: num(col(row, headers, ['spo2', 'spo2_percentage', 'blood_oxygen'])), unit: 'percent' },
      { type: 'skin_temp_deviation', value: num(col(row, headers, ['skin_temp', 'skin_temp_celsius', 'skin_temperature'])), unit: 'celsius' },
      { type: 'respiratory_rate', value: num(col(row, headers, ['respiratory_rate', 'resp_rate'])), unit: 'breaths_per_min' }
    ];

    for (const m of mappings) {
      if (m.value != null) {
        metrics.push({
          metric_type: m.type,
          value: m.value,
          unit: m.unit,
          recorded_at: recordedAt,
          external_id: `whoop_csv:cycle:${recordedAt}:${m.type}`
        });
      }
    }
  }

  ingestMetricBatch(userId, 'whoop', metrics);
  return { metrics: metrics.length };
}

function parseSleepsCsv(userId, content) {
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
  if (records.length === 0) return { sleeps: 0 };

  const headers = Object.keys(records[0]);
  const sleeps = [];

  for (const row of records) {
    const startAt = toIso(col(row, headers, ['start', 'sleep_onset', 'sleep_start']));
    const endAt = toIso(col(row, headers, ['end', 'wake_time', 'sleep_end']));
    if (!startAt || !endAt) continue;

    const totalMs = msFromHours(col(row, headers, ['total_sleep_time', 'total_sleep', 'total_in_bed_time']))
      || (new Date(endAt).getTime() - new Date(startAt).getTime());

    sleeps.push({
      sleep_date: endAt.slice(0, 10),
      start_at: startAt,
      end_at: endAt,
      total_duration_ms: totalMs,
      slow_wave_ms: msFromMinutes(col(row, headers, ['time_in_deep_sleep', 'slow_wave_sleep', 'deep_sleep'])),
      rem_ms: msFromMinutes(col(row, headers, ['time_in_rem_sleep', 'rem_sleep', 'rem'])),
      light_ms: msFromMinutes(col(row, headers, ['time_in_light_sleep', 'light_sleep', 'light'])),
      awake_ms: msFromMinutes(col(row, headers, ['time_awake', 'awake_time', 'awake'])),
      sleep_performance: num(col(row, headers, ['sleep_performance', 'performance'])),
      sleep_need_ms: msFromHours(col(row, headers, ['sleep_need', 'sleep_debt'])),
      sleep_efficiency: num(col(row, headers, ['sleep_efficiency', 'efficiency'])),
      respiratory_rate: num(col(row, headers, ['respiratory_rate', 'resp_rate'])),
      external_id: `whoop_csv:sleep:${startAt}`
    });
  }

  ingestSleepBatch(userId, 'whoop', sleeps);
  return { sleeps: sleeps.length };
}

function parseWorkoutsCsv(userId, content) {
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
  if (records.length === 0) return { workouts: 0 };

  const headers = Object.keys(records[0]);
  const workouts = [];

  for (const row of records) {
    const startAt = toIso(col(row, headers, ['start', 'workout_start', 'start_time']));
    const endAt = toIso(col(row, headers, ['end', 'workout_end', 'end_time']));
    if (!startAt || !endAt) continue;

    const durationMs = msFromMinutes(col(row, headers, ['duration', 'workout_duration']))
      || (new Date(endAt).getTime() - new Date(startAt).getTime());

    const energyKj = num(col(row, headers, ['energy_burned', 'kilojoules', 'kilojoule']));

    workouts.push({
      sport_type: col(row, headers, ['activity_name', 'sport_name', 'sport_type', 'activity']) || 'Workout',
      start_at: startAt,
      end_at: endAt,
      duration_ms: durationMs,
      avg_hr: num(col(row, headers, ['average_heart_rate', 'avg_hr', 'avg_heart_rate'])),
      max_hr: num(col(row, headers, ['max_heart_rate', 'max_hr'])),
      strain: num(col(row, headers, ['strain', 'workout_strain'])),
      energy_kj: energyKj,
      energy_kcal: energyKj != null ? energyKj * 0.239006 : num(col(row, headers, ['calories', 'energy_kcal'])),
      distance_m: num(col(row, headers, ['distance', 'distance_m', 'distance_meters'])),
      external_id: `whoop_csv:workout:${startAt}`
    });
  }

  ingestWorkoutBatch(userId, 'whoop', workouts);
  return { workouts: workouts.length };
}

function extractZip(zipPath) {
  const extractDir = zipPath + '_extracted';
  fs.mkdirSync(extractDir, { recursive: true });
  execSync(`unzip -o -q "${zipPath}" -d "${extractDir}"`);
  return extractDir;
}

function findCsvFiles(dir) {
  const files = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, findCsvFiles(fullPath));
    } else if (entry.name.toLowerCase().endsWith('.csv')) {
      const lower = entry.name.toLowerCase();
      if (lower.includes('physiological') || lower.includes('cycle')) files.cycles = fullPath;
      else if (lower.includes('sleep')) files.sleeps = fullPath;
      else if (lower.includes('workout')) files.workouts = fullPath;
    }
  }

  return files;
}

function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

async function parseWhoopExport(userId, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const counts = { metrics: 0, sleeps: 0, workouts: 0 };

  if (ext === '.zip') {
    const extractDir = extractZip(filePath);
    try {
      const csvFiles = findCsvFiles(extractDir);

      if (csvFiles.cycles) {
        const result = parseCyclesCsv(userId, fs.readFileSync(csvFiles.cycles, 'utf-8'));
        counts.metrics += result.metrics;
      }
      if (csvFiles.sleeps) {
        const result = parseSleepsCsv(userId, fs.readFileSync(csvFiles.sleeps, 'utf-8'));
        counts.sleeps += result.sleeps;
      }
      if (csvFiles.workouts) {
        const result = parseWorkoutsCsv(userId, fs.readFileSync(csvFiles.workouts, 'utf-8'));
        counts.workouts += result.workouts;
      }

      if (!csvFiles.cycles && !csvFiles.sleeps && !csvFiles.workouts) {
        throw new Error('No recognized WHOOP CSV files found in ZIP');
      }
    } finally {
      cleanupDir(extractDir);
    }
  } else if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf-8');
    const firstLine = content.split('\n')[0].toLowerCase();

    if (firstLine.includes('recovery') || firstLine.includes('strain') || firstLine.includes('cycle')) {
      const result = parseCyclesCsv(userId, content);
      counts.metrics += result.metrics;
    } else if (firstLine.includes('sleep')) {
      const result = parseSleepsCsv(userId, content);
      counts.sleeps += result.sleeps;
    } else if (firstLine.includes('workout') || firstLine.includes('activity')) {
      const result = parseWorkoutsCsv(userId, content);
      counts.workouts += result.workouts;
    } else {
      throw new Error('Unrecognized CSV format. Expected WHOOP physiological_cycles, sleeps, or workouts CSV.');
    }
  } else {
    throw new Error('Unsupported file format. Upload a .zip or .csv file from WHOOP export.');
  }

  return counts;
}

module.exports = { parseWhoopExport };
