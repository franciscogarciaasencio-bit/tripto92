import { advanceProgression } from '../../domain/progression';
import type { ProgressionState } from '../../domain/progression';
import type { SqlConnection } from './connection';
import { checkpointMetadata, decodeAwardRow, decodeCheckpoint, decodeSessionRow, type RulesRegistry } from './decoders';
import { PersistenceError } from './errors';
import { validateIntegrity } from './integrity';
import { integer, object, requireData, text } from './validation';

export async function loadState(sql: SqlConnection, registry: RulesRegistry): Promise<ProgressionState> {
  try {
    const checkpoints = await sql.all('SELECT * FROM progression_checkpoint');
    if (checkpoints.length === 0) throw new PersistenceError('MISSING_CHECKPOINT', 'Progression checkpoint is missing; history has not been changed');
    requireData(checkpoints.length === 1 && object(checkpoints[0]).id === 1, 'Invalid checkpoint singleton');
    const meta = decodeCheckpoint(checkpoints[0]);
    const ruleRows = await sql.all('SELECT * FROM progression_rules ORDER BY sequence');
    const ruleSets = ruleRows.map((value, index) => {
      const row = object(value);
      requireData(integer(row.sequence, 1) === index + 1, 'Invalid rules sequence');
      const rules = registry.decode(row.rules_json);
      requireData(text(row.version) === rules.version, 'Rules version key mismatch');
      return rules;
    });
    const rows = (await sql.all('SELECT * FROM meditation_sessions ORDER BY sequence')).map(decodeSessionRow);
    const sessions = rows.map((row, index) => {
      requireData(row.sequence === index + 1, 'Invalid session sequence');
      return { session: row.session, qualified: row.qualified, qualificationRulesVersion: row.qualificationRulesVersion };
    });
    const awards = (await sql.all('SELECT * FROM progression_awards ORDER BY sequence')).map((value, index) => {
      requireData(integer(object(value).sequence, 1) === index + 1, 'Invalid award sequence');
      return decodeAwardRow(value);
    });
    requireData(sessions.length === meta.sessionCount && awards.length === meta.awardCount && ruleSets.length === meta.ruleSetCount,
      'Checkpoint record counts do not match history');
    const state: ProgressionState = {
      schemaVersion: meta.schemaVersion, asOf: meta.asOf, settledThroughDate: meta.settledThroughDate,
      activeRulesVersion: meta.activeRulesVersion, occasions: meta.occasions, highestRankAchieved: meta.highestRankAchieved,
      currentProgressionCenti: meta.currentProgressionCenti, ruleSets, sessions, awards,
      lifetimeXpCenti: awards.reduce((total, award) => integer(total + award.xpCenti), 0),
      totalMeditationSeconds: sessions.reduce((total, entry) => integer(total + entry.session.activeDurationSeconds), 0),
    };
    validateIntegrity(state);
    // Same validated cursor: no decay or earnings replay. Domain detaches/freezes the loaded state.
    return advanceProgression(state, state.asOf);
  } catch (cause) {
    if (cause instanceof PersistenceError) throw cause;
    throw new PersistenceError('INVALID_DATA', 'Could not restore progression safely', { cause });
  }
}

export async function writeCheckpoint(sql: SqlConnection, state: ProgressionState): Promise<void> {
  await sql.run(`INSERT INTO progression_checkpoint(id, current_progression_centi, metadata_json) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET current_progression_centi = excluded.current_progression_centi, metadata_json = excluded.metadata_json`,
  [state.currentProgressionCenti, JSON.stringify(checkpointMetadata(state))]);
}

/** Persist only newly appended ledger entries; SQL triggers forbid changes to historical entries. */
export async function appendTransition(sql: SqlConnection, before: ProgressionState | null, after: ProgressionState, createdAt: number): Promise<void> {
  for (let i = before?.ruleSets.length ?? 0; i < after.ruleSets.length; i++) {
    const rules = after.ruleSets[i]!;
    await sql.run('INSERT INTO progression_rules(version, sequence, rules_json) VALUES (?, ?, ?)', [rules.version, i + 1, JSON.stringify(rules)]);
  }
  for (let i = before?.sessions.length ?? 0; i < after.sessions.length; i++) {
    const entry = after.sessions[i]!;
    const s = entry.session;
    await sql.run(`INSERT INTO meditation_sessions(id, sequence, started_at, ended_at, active_seconds, paused_seconds,
      status, local_date, time_zone, created_at, qualified, qualification_rules_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.id, i + 1, s.startedAt, s.endedAt, s.activeDurationSeconds, s.pausedDurationSeconds, s.status, s.localDate, s.timeZone,
      createdAt, entry.qualified ? 1 : 0, entry.qualificationRulesVersion]);
  }
  for (let i = before?.awards.length ?? 0; i < after.awards.length; i++) {
    const a = after.awards[i]!;
    await sql.run(`INSERT INTO progression_awards(id, sequence, session_id, occasion_id, rules_version, awarded_at,
      local_date, reward_date, xp_centi, breakdown_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, i + 1, a.sessionId, a.occasionId, a.rulesVersion, a.awardedAt, a.localDate, a.rewardDate, a.xpCenti, JSON.stringify(a.breakdown)]);
  }
  await writeCheckpoint(sql, after);
}
