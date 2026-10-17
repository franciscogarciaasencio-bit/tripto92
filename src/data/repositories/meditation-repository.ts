import { advanceProgression, changeProgressionRules, createProgressionState, getProgressSnapshot, JOURNEY_VERSION, readingContext } from '../../domain/progression';
import type { CalendarContext, MeditationSession } from '../../domain/progression';
import type { Transactions } from '../database/connection';
import { checkpointMetadata, decodeAwardRow, decodeContext, decodeSession, decodeSessionRow, type RulesRegistry, type StoredMeditationSession } from '../database/decoders';
import { appendTransition, loadState, writeCheckpoint } from '../database/records';
import { canonical, integer, requireData, text, timestamp } from '../database/validation';
import { completedPracticeCount, isSetAside, loadCompletion, pendingCompletion, persistCompletion } from '../database/completions';
import { loadJourney } from '../database/journey';
import { currentGeneration } from '../database/generations';
import { loadTimer } from './timer-repository';
import { resetAllPracticeData } from '../database/reset-practice';
import { loadHabit } from '../database/habit';

export interface HistoryQuery { readonly limit?: number; readonly offset?: number }
export interface PracticeDetails extends StoredMeditationSession {
  /** Original immutable reward, in centi-Ripples. Reading never recalculates or replays it. */
  readonly awardedXpCenti: number;
  /**
   * Its split, from the same receipt: Ripples for the practice itself and those its Consistency added.
   * Null for receipts from before Consistency was a separate bonus (rules V1–V3).
   */
  readonly split: { readonly practiceXpCenti: number; readonly consistencyXpCenti: number } | null;
}

export function createMeditationRepository(database: Transactions, registry: RulesRegistry) {
  return {
    async resetAllPracticeData(input: CalendarContext) {
      const asOf = decodeContext(input);
      return database.transaction((sql) => resetAllPracticeData(sql, registry, asOf));
    },
    loadProgressionState: () => database.transaction((sql) => loadState(sql, registry)),
    getCompletedPracticeCount: () => database.transaction(completedPracticeCount),
    getPendingCompletion: () => database.transaction(pendingCompletion),
    async getPracticeDetails(id: string): Promise<PracticeDetails | null> {
      const sessionId = text(id);
      return database.transaction(async (sql) => {
        const value = (await sql.all('SELECT * FROM meditation_sessions WHERE id = ?', [sessionId]))[0];
        if (!value) return null;
        const row = decodeSessionRow(value);
        registry.get(row.qualificationRulesVersion);
        const awardValue = (await sql.all('SELECT * FROM progression_awards WHERE session_id = ?', [sessionId]))[0];
        const award = awardValue ? decodeAwardRow(awardValue) : null;
        if (award) registry.get(award.rulesVersion);
        const practice = award?.breakdown.incrementalBaseCentiXp, consistency = award?.breakdown.bonusCentiXp;
        const split = award && practice !== undefined && consistency !== undefined ? { practiceXpCenti: practice, consistencyXpCenti: consistency }
          : award ? null : { practiceXpCenti: 0, consistencyXpCenti: 0 };
        return { session: row.session, createdAt: row.createdAt, awardedXpCenti: award?.xpCenti ?? 0, split };
      });
    },
    async acknowledgeCompletion(id: string, acknowledgedAt: number) {
      const at = timestamp(acknowledgedAt);
      return database.transaction(async (sql) => {
        const completion = await loadCompletion(sql, id);
        requireData(completion && at >= completion.session.endedAt, 'Invalid completion acknowledgement');
        await sql.run('UPDATE practice_completions SET acknowledged_at = COALESCE(acknowledged_at, ?) WHERE session_id = ?', [at, id]);
      });
    },
    async completePractice(input: MeditationSession, createdAt: number) {
      const session = decodeSession(input);
      const created = timestamp(createdAt);
      requireData(created >= session.endedAt, 'Creation timestamp precedes completion');
      return database.transaction(async (sql) => {
        const after = await persistCompletion(sql, await loadState(sql, registry), session, created);
        const habit = await loadHabit(sql, after);
        const progress = { snapshot: getProgressSnapshot(after, after.asOf), journey: habit?.journey ?? await loadJourney(sql, after), habit: habit?.checkpoint ?? null };
        // Unplaceable practice is kept aside: there is no completion summary, and nothing was earned.
        if (await isSetAside(sql, session.id)) return { ...progress, completion: null, setAside: true as const };
        const completion = await loadCompletion(sql, session.id);
        requireData(completion, 'Legacy history cannot fabricate a completion summary');
        return { ...progress, completion, setAside: false as const };
      });
    },

    async recordCompletedMeditation(input: MeditationSession, createdAt: number) {
      // Decode immediately so caller mutation while this operation is queued cannot affect the save.
      const session = decodeSession(input);
      const created = timestamp(createdAt);
      requireData(created >= session.endedAt, 'Creation timestamp precedes completion');
      return database.transaction(async (sql) => {
        const before = await loadState(sql, registry);
        const after = await persistCompletion(sql, before, session, created);
        return getProgressSnapshot(after, after.asOf);
      });
    },

    async getMeditationHistory(query: HistoryQuery = {}): Promise<readonly StoredMeditationSession[]> {
      const limit = integer(query.limit ?? 50, 1);
      const offset = integer(query.offset ?? 0);
      requireData(limit <= 1000, 'History limit must not exceed 1000');
      return database.transaction(async (sql) => {
        const rows = await sql.all('SELECT * FROM meditation_sessions ORDER BY ended_at DESC, sequence DESC LIMIT ? OFFSET ?', [limit, offset]);
        return rows.map((value) => {
          const row = decodeSessionRow(value);
          return { session: row.session, createdAt: row.createdAt };
        });
      });
    },

    async getCurrentProgressionSnapshot(input: CalendarContext) {
      const now = decodeContext(input);
      return database.transaction(async (sql) => {
        const loaded = await loadState(sql, registry);
        // A device clock behind the stored settlement reads at that settlement; it never rewinds.
        const asOf = readingContext(loaded.asOf, now);
        const state = advanceProgression(loaded, asOf);
        await writeCheckpoint(sql, state);
        await loadJourney(sql, state);
        return getProgressSnapshot(state, asOf);
      });
    },

    async getCurrentPracticeProgress(input: CalendarContext) {
      const now = decodeContext(input);
      return database.transaction(async (sql) => {
        const loaded = await loadState(sql, registry);
        const asOf = readingContext(loaded.asOf, now);
        const state = advanceProgression(loaded, asOf);
        await writeCheckpoint(sql, state);
        const habit = await loadHabit(sql, state);
        return { snapshot: getProgressSnapshot(state, asOf), journey: habit?.journey ?? await loadJourney(sql, state), habit: habit?.checkpoint ?? null };
      });
    },

    /** Archive this journey, preserving immutable history, then begin an empty generation. */
    async resetProgression(input: CalendarContext) {
      const asOf = decodeContext(input);
      return database.transaction(async (sql) => {
        requireData(await loadTimer(sql) === null, 'Finish or discard the current meditation before resetting progression');
        requireData(await pendingCompletion(sql) === null, 'Return Home from the pending completion before resetting progression');
        const loaded = await loadState(sql, registry);
        // Destructive: never placed at a moment before the settled one (device clock behind).
        if (asOf.timestamp < loaded.asOf.timestamp) throw new RangeError('Cannot rewind progression time');
        const before = advanceProgression(loaded, asOf);
        const generation = await currentGeneration(sql);
        // A retry of the same confirmed boundary cannot manufacture additional generations.
        if (generation.boundary && canonical(generation.boundary) === canonical(asOf) && before.sessions.length === 0) {
          return { snapshot: getProgressSnapshot(before, asOf), journey: await loadJourney(sql, before) };
        }
        await loadJourney(sql, before);
        await loadHabit(sql, before);
        const achievement = (await sql.all('SELECT * FROM journey_checkpoint'))[0];
        await sql.run(`UPDATE progression_generations SET closed_checkpoint_json = ?, closed_progression_centi = ?,
          closed_journey_json = ? WHERE id = ?`,
        [JSON.stringify(checkpointMetadata(before)), before.currentProgressionCenti, JSON.stringify(achievement), generation.id]);
        const nextId = integer(generation.id + 1, 1);
        await sql.run('INSERT INTO progression_generations(id, started_at, boundary_json) VALUES (?, ?, ?)',
          [nextId, asOf.timestamp, JSON.stringify(asOf)]);
        // Historical rule snapshots remain global and immutable, even when the journey balance resets.
        const empty = createProgressionState(asOf, registry.get(before.activeRulesVersion));
        const after = advanceProgression({ ...empty, ruleSets: before.ruleSets }, asOf);
        for (const activation of after.consistencyActivations ?? []) await sql.run(
          'INSERT INTO progression_consistency_activations(generation_id, rules_version, activation_json) VALUES (?, ?, ?)',
          [nextId, activation.rulesVersion, JSON.stringify(activation)]);
        await writeCheckpoint(sql, after);
        await sql.run(`UPDATE journey_checkpoint SET generation_id = ?, version = ?, level = 0, achieved_at = ? WHERE id = 1`,
          [nextId, JOURNEY_VERSION, asOf.timestamp]);
        await loadHabit(sql, after, true);
        return { snapshot: getProgressSnapshot(after, asOf), journey: await loadJourney(sql, after) };
      });
    },

    /** Deliberate release boundary; opening the database never opts into new rules automatically. */
    async changeRules(version: string, input: CalendarContext) {
      const rules = registry.get(version);
      const asOf = decodeContext(input);
      return database.transaction(async (sql) => {
        const before = await loadState(sql, registry);
        const after = changeProgressionRules(before, rules, asOf);
        await appendTransition(sql, before, after, asOf.timestamp);
        await loadHabit(sql, after, !before.ruleSets.find((rule) => rule.version === before.activeRulesVersion)?.continuousConsistency);
        return getProgressSnapshot(after, asOf);
      });
    },
  };
}
export type MeditationRepository = ReturnType<typeof createMeditationRepository>;
