import { getJourneyFromState, getLifetimeJourney, JOURNEY_VERSION, practiceCredits, type ProgressionState, type JourneyAchievement } from '../../domain/progression';
import type { SqlConnection } from './connection';
import { integer, object, requireData, text, timestamp } from './validation';

/** Credits/dates are always derived from immutable sessions; only a legitimately unlocked peak is stored. */
export async function loadJourney(sql: SqlConnection, state: ProgressionState, initialize = false) {
  const rows = await sql.all('SELECT * FROM journey_checkpoint');
  let achievement: JourneyAchievement | null = null;
  if (rows.length) {
    requireData(rows.length === 1, 'Invalid journey singleton');
    const row = object(rows[0]);
    requireData(row.id === 1 && text(row.version) === JOURNEY_VERSION, 'Unsupported journey version');
    const level = integer(row.level, 1);
    requireData(level <= 125, 'Invalid highest journey level');
    achievement = { version: JOURNEY_VERSION, level, achievedAt: timestamp(row.achieved_at) };
    const achievedAt = achievement.achievedAt;
    const atPeak = practiceCredits(state.sessions.filter((entry) => entry.session.endedAt <= achievedAt).map((entry) => entry.session));
    const legitimate = getLifetimeJourney({ credits: atPeak.credits, realDays: atPeak.realDays, firstPracticeAt: atPeak.firstPracticeAt,
      lifetimeXpCenti: state.awards.filter((award) => award.awardedAt <= achievedAt).reduce((sum, award) => integer(sum + award.xpCenti), 0),
      asOf: achievedAt });
    requireData(level <= legitimate.level.number, 'Journey achievement does not meet its recorded requirements');
  } else requireData(initialize, 'Journey checkpoint is missing; history has not been changed');
  const journey = getJourneyFromState(state, achievement);
  // A peak is persistent. This milestone never grants unmet requirements during backfill.
  if (!achievement || journey.level.number > achievement.level) {
    await sql.run(`INSERT INTO journey_checkpoint(id, version, level, achieved_at) VALUES(1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET level = excluded.level, achieved_at = excluded.achieved_at`,
    [JOURNEY_VERSION, journey.level.number, state.asOf.timestamp]);
  }
  return journey;
}
export async function persistJourneyCompletion(sql: SqlConnection, before: ProgressionState, after: ProgressionState, sessionId: string) {
  const beforeJourney = await loadJourney(sql, before);
  const afterJourney = await loadJourney(sql, after);
  const session = after.sessions.at(-1)!.session;
  const credit = practiceCredits(after.sessions.map((entry) => entry.session));
  const dateCredits = credit.dates.find((day) => day.localDate === session.localDate)?.credits ?? 0;
  await sql.run('INSERT INTO journey_completions(session_id, before_level, after_level, credits_added, date_credits) VALUES (?, ?, ?, ?, ?)',
    [sessionId, beforeJourney.level.number, afterJourney.level.number,
      afterJourney.metrics.credits - beforeJourney.metrics.credits, dateCredits]);
}
export function decodeJourneyCompletion(value: unknown) {
  if (value === null) return null;
  const row = object(value);
  const beforeLevel = integer(row.before_level, 1), afterLevel = integer(row.after_level, 1);
  const creditsAdded = integer(row.credits_added), dateCredits = integer(row.date_credits);
  requireData(afterLevel >= beforeLevel && afterLevel <= 125 && creditsAdded <= 1 && dateCredits <= 2 && creditsAdded <= dateCredits,
    'Invalid journey completion');
  return { beforeLevel, afterLevel, creditsAdded, dateCredits };
}
