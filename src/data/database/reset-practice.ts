import { advanceProgression, createProgressionState, getProgressSnapshot, type CalendarContext } from '../../domain/progression';
import type { SqlConnection } from './connection';
import type { RulesRegistry } from './decoders';
import { loadState, writeCheckpoint } from './records';
import { loadJourney } from './journey';
import { requireData } from './validation';
import { loadHabit } from './habit';

// Explicit deletion is the sole exception to append-only history. Names and DDL are
// fixed here; ordinary repository writes never disable these guards.
export const deleteGuards = [
  ['sync_set_aside_sessions_immutable_delete', 'sync_set_aside_sessions'],
  ['consistency_activations_immutable_delete', 'progression_consistency_activations'],
  ['habit_reward_receipts_immutable_delete', 'habit_reward_receipts'],
  ['journey_animation_receipts_immutable_delete', 'journey_animation_receipts'],
  ['journey_legacy_peaks_immutable_delete', 'journey_legacy_peaks'],
  ['journey_completions_no_delete', 'journey_completions'],
  ['practice_completions_no_delete', 'practice_completions'],
  ['meditation_sessions_immutable_delete', 'meditation_sessions'],
  ['progression_awards_immutable_delete', 'progression_awards'],
  ['progression_generations_no_delete', 'progression_generations'],
  ['journey_checkpoint_no_delete', 'journey_checkpoint'],
  ['legacy_journey_checkpoint_immutable_delete', 'legacy_journey_checkpoint'],
] as const;

/** Only confirmed reset and validated ledger replacement suspend guards, inside their own transaction. */
export async function suspendDeleteGuards(sql: SqlConnection) {
  for (const [name] of deleteGuards) {
    requireData((await sql.all("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = ?", [name])).length === 1,
      'Practice deletion guard is missing');
    await sql.exec(`DROP TRIGGER ${name}`);
  }
}
export async function restoreDeleteGuards(sql: SqlConnection) {
  for (const [name, table] of deleteGuards) await sql.exec(`CREATE TRIGGER ${name} BEFORE DELETE ON ${table}
    BEGIN SELECT RAISE(ABORT, 'Historical practice is immutable; cannot be deleted outside confirmed reset'); END;`);
}

/** Caller owns BEGIN IMMEDIATE: records, guards and empty continuation commit together. */
export async function resetAllPracticeData(sql: SqlConnection, registry: RulesRegistry, asOf: CalendarContext) {
  const before = advanceProgression(await loadState(sql, registry), asOf);
  await suspendDeleteGuards(sql);
  for (const table of ['meditation_timer', 'sync_set_aside_sessions', 'habit_reward_receipts', 'habit_checkpoints', 'journey_animation_receipts', 'journey_legacy_peaks', 'journey_completions', 'progression_consistency_activations',
    'practice_completions', 'progression_awards', 'meditation_sessions', 'journey_checkpoint', 'legacy_journey_checkpoint',
    'progression_checkpoint', 'progression_generations']) await sql.run(`DELETE FROM ${table}`);
  // Retain a durable time boundary so an older connection/cursor cannot restore deleted practice.
  await sql.run('INSERT INTO progression_generations(id, started_at, boundary_json) VALUES(1, ?, ?)',
    [asOf.timestamp, JSON.stringify(asOf)]);
  const empty = createProgressionState(asOf, registry.get(before.activeRulesVersion));
  const after = advanceProgression({ ...empty, ruleSets: before.ruleSets }, asOf);
  for (const activation of after.consistencyActivations ?? []) await sql.run(
    'INSERT INTO progression_consistency_activations(generation_id, rules_version, activation_json) VALUES(1, ?, ?)',
    [activation.rulesVersion, JSON.stringify(activation)]);
  await writeCheckpoint(sql, after);
  const journey = await loadJourney(sql, after, true);
  const habit = await loadHabit(sql, after, true);
  await restoreDeleteGuards(sql);
  return { snapshot: getProgressSnapshot(after, asOf), journey: habit?.journey ?? journey, habit: habit?.checkpoint ?? null };
}
