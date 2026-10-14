import { getJourneyFromState, getLifetimeJourney, getJourneyProgressTransition, JOURNEY_VERSION, LEGACY_JOURNEY_VERSION, practiceCredits, type ProgressionState, type JourneyAchievement, type JourneyProgressTransition } from '../../domain/progression';
import type { SqlConnection } from './connection';
import { integer, object, requireData, text, timestamp } from './validation';
import { currentGeneration } from './generations';

export function validateJourneyAchievement(value: unknown, state: ProgressionState, generationId: number, startedAt = 0, legacy: JourneyAchievement | null = null): JourneyAchievement {
  const row = object(value);
  const version = text(row.version);
  requireData(row.id === 1 && row.generation_id === generationId && [JOURNEY_VERSION, LEGACY_JOURNEY_VERSION].includes(version), 'Unsupported journey version or generation');
  const level = integer(row.level);
  requireData(level <= 125, 'Invalid highest journey level');
  const achievedAt = timestamp(row.achieved_at);
  requireData(achievedAt >= startedAt && achievedAt <= state.asOf.timestamp, 'Journey achievement is outside its progression generation');
  const atPeak = practiceCredits(state.sessions.filter((entry) => entry.session.endedAt <= achievedAt).map((entry) => entry.session));
  const legitimate = getLifetimeJourney({ credits: atPeak.credits, realDays: atPeak.realDays, firstPracticeAt: atPeak.firstPracticeAt,
    lifetimeXpCenti: state.awards.filter((award) => award.awardedAt <= achievedAt).reduce((sum, award) => integer(sum + award.xpCenti), 0), asOf: achievedAt }, null, { version });
  const retained = version === JOURNEY_VERSION && legacy && legacy.achievedAt <= achievedAt ? legacy.level : 0;
  requireData(level <= Math.max(legitimate.level.number, retained), 'Journey achievement does not meet its recorded requirements');
  return { version, level, achievedAt };
}

export async function legacyJourneyPeak(sql: SqlConnection, state: ProgressionState, generationId: number, startedAt: number) {
  const row = (await sql.all('SELECT *, 1 AS id FROM journey_legacy_peaks WHERE generation_id = ?', [generationId]))[0];
  return row ? validateJourneyAchievement(row, state, generationId, startedAt) : null;
}

/** Credits/dates are always derived from immutable sessions; only a legitimately unlocked peak is stored. */
export async function loadJourney(sql: SqlConnection, state: ProgressionState, initialize = false) {
  const generation = await currentGeneration(sql);
  const rows = await sql.all('SELECT * FROM journey_checkpoint');
  let achievement: JourneyAchievement | null = null;
  const legacy = await legacyJourneyPeak(sql, state, generation.id, generation.startedAt);
  if (rows.length) {
    requireData(rows.length === 1, 'Invalid journey singleton');
    requireData(object(rows[0]).version === JOURNEY_VERSION, 'Unsupported active journey version');
    achievement = validateJourneyAchievement(rows[0], state, generation.id, generation.startedAt, legacy);
  } else requireData(initialize, 'Journey checkpoint is missing; history has not been changed');
  const journey = getJourneyFromState(state, achievement);
  // A peak is persistent. This milestone never grants unmet requirements during backfill.
  if (!achievement || journey.level.number > achievement.level) {
    await sql.run(`INSERT INTO journey_checkpoint(id, generation_id, version, level, achieved_at) VALUES(1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET level = excluded.level, achieved_at = excluded.achieved_at`,
    [generation.id, JOURNEY_VERSION, journey.level.number, state.asOf.timestamp]);
  }
  return journey;
}
export async function persistJourneyCompletion(sql: SqlConnection, before: ProgressionState, after: ProgressionState, sessionId: string) {
  const beforeJourney = await loadJourney(sql, before);
  const afterJourney = await loadJourney(sql, after);
  const session = after.sessions.at(-1)!.session;
  const credit = practiceCredits(after.sessions.map((entry) => entry.session));
  const dateCredits = credit.dates.find((day) => day.localDate === session.localDate)?.credits ?? 0;
  await sql.run('INSERT INTO journey_completions(session_id, before_level, after_level, credits_added, date_credits, display_version) VALUES (?, ?, ?, ?, ?, 3)',
    [sessionId, beforeJourney.level.number, afterJourney.level.number,
      afterJourney.metrics.credits - beforeJourney.metrics.credits, dateCredits]);
  await sql.run('INSERT INTO journey_animation_receipts(session_id, projection_json) VALUES (?, ?)',
    [sessionId, JSON.stringify(getJourneyProgressTransition(beforeJourney, afterJourney))]);
}
export function decodeJourneyCompletion(value: unknown) {
  if (value === null) return null;
  const row = object(value);
  const beforeLevel = integer(row.before_level), afterLevel = integer(row.after_level);
  const creditsAdded = integer(row.credits_added), dateCredits = integer(row.date_credits);
  requireData(afterLevel >= beforeLevel && afterLevel <= 125 && creditsAdded <= 1 && dateCredits <= 2 && creditsAdded <= dateCredits,
    'Invalid journey completion');
  return { beforeLevel, afterLevel, creditsAdded, dateCredits };
}

export function decodeJourneyTransition(value: unknown, expectedVersion = JOURNEY_VERSION): JourneyProgressTransition {
  const row = object(value), beforeLevel = integer(row.beforeLevel), afterLevel = integer(row.afterLevel);
  requireData(text(row.version) === expectedVersion && afterLevel >= beforeLevel && afterLevel <= 125 &&
    Array.isArray(row.segments) && row.segments.length === afterLevel - beforeLevel + 1, 'Invalid reward animation receipt');
  const segments = row.segments.map((value: unknown, index: number) => {
    const segment = object(value), level = integer(segment.level);
    const from = segment.from, to = segment.to;
    requireData(level === beforeLevel + index && typeof from === 'number' && typeof to === 'number' &&
      Number.isFinite(from) && Number.isFinite(to) && from >= 0 && from <= 1 && to >= from && to <= 1 &&
      (index === 0 || from === 0) && (index === afterLevel - beforeLevel || to === 1), 'Invalid reward animation segment');
    return { level, from, to };
  });
  return { version: expectedVersion, beforeLevel, afterLevel, segments };
}
