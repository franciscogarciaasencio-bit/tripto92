import { advanceProgression, validateConsistencyActivation } from '../../domain/progression';
import type { ProgressionState } from '../../domain/progression';
import type { SqlConnection } from './connection';
import { checkpointMetadata, decodeAwardRow, decodeCheckpoint, decodeSessionRow, decodeConsistencyActivation, type RulesRegistry } from './decoders';
import { PersistenceError } from './errors';
import { validateIntegrity } from './integrity';
import { canonical, integer, object, requireData, text, json } from './validation';
import { currentGeneration, loadGenerations } from './generations';
import { validateJourneyAchievement } from './journey';

/** Validate both current and archived journeys; no historical earnings are replayed. */
export async function loadGenerationStates(sql: SqlConnection, registry: RulesRegistry) {
  try {
    const checkpoints = await sql.all('SELECT * FROM progression_checkpoint');
    if (checkpoints.length === 0) throw new PersistenceError('MISSING_CHECKPOINT', 'Progression checkpoint is missing; history has not been changed');
    requireData(checkpoints.length === 1 && object(checkpoints[0]).id === 1, 'Invalid checkpoint singleton');
    const generations = await loadGenerations(sql);
    const ruleRows = await sql.all('SELECT * FROM progression_rules ORDER BY sequence');
    const ruleSets = ruleRows.map((value, index) => {
      const row = object(value);
      requireData(integer(row.sequence, 1) === index + 1, 'Invalid rules sequence');
      const rules = registry.decode(row.rules_json);
      requireData(text(row.version) === rules.version, 'Rules version key mismatch');
      return rules;
    });
    const sessionRows = await sql.all('SELECT * FROM meditation_sessions ORDER BY sequence');
    const rows = sessionRows.map(decodeSessionRow);
    rows.forEach((row, index) => {
      requireData(row.sequence === index + 1, 'Invalid session sequence');
      requireData(index === 0 || row.session.startedAt >= rows[index - 1]!.session.endedAt, 'Historical sessions overlap or are out of order');
    });
    const awardRows = await sql.all('SELECT * FROM progression_awards ORDER BY sequence');
    const legacyPeaks = await sql.all('SELECT *, 1 AS id FROM journey_legacy_peaks');
    const activationRows = await sql.all('SELECT * FROM progression_consistency_activations ORDER BY generation_id, rules_version');
    const activations = activationRows.map(value => {
      const row = object(value), activation = decodeConsistencyActivation(json(row.activation_json));
      requireData(text(row.rules_version) === activation.rulesVersion, 'Consistency activation key mismatch');
      const generationId = integer(row.generation_id, 1);
      requireData(generationId <= generations.length, 'Unknown consistency activation generation');
      return { generationId, activation };
    });
    const allAwards = awardRows.map((value, index) => {
      requireData(integer(object(value).sequence, 1) === index + 1, 'Invalid award sequence');
      return decodeAwardRow(value);
    });
    for (const value of [...sessionRows, ...awardRows]) {
      requireData(integer(object(value).generation_id, 1) <= generations.length, 'Record has an unknown progression generation');
    }
    const sessionGenerations = new Map(sessionRows.map((value) => {
      const row = object(value);
      return [text(row.id), integer(row.generation_id, 1)] as const;
    }));
    for (const value of awardRows) {
      const row = object(value);
      requireData(sessionGenerations.get(text(row.session_id)) === integer(row.generation_id, 1), 'Award belongs to a different progression generation');
    }
    const states = generations.map((generation, index) => {
    const meta = decodeCheckpoint(generation.checkpoint ?? checkpoints[0]);
    const sessions = rows.filter((_, i) => object(sessionRows[i]).generation_id === generation.id).map((row) => {
      requireData(row.session.startedAt >= generation.startedAt && (!generations[index + 1] ||
        row.session.endedAt <= generations[index + 1]!.startedAt), 'Session crosses its progression generation boundary');
      return { session: row.session, qualified: row.qualified, qualificationRulesVersion: row.qualificationRulesVersion };
    });
    const awards = allAwards.filter((_, i) => object(awardRows[i]).generation_id === generation.id);
    const generationRules = ruleSets.slice(0, meta.ruleSetCount);
    const consistencyActivations = activations.filter(value => value.generationId === generation.id)
      .map(value => value.activation).sort((a,b) => a.asOf.timestamp - b.asOf.timestamp ||
        generationRules.findIndex(rule => rule.version === a.rulesVersion) - generationRules.findIndex(rule => rule.version === b.rulesVersion));
    requireData(consistencyActivations.length === meta.consistencyActivationCount, 'Consistency activation count disagrees with checkpoint');
    requireData(sessions.length === meta.sessionCount && awards.length === meta.awardCount && generationRules.length === meta.ruleSetCount &&
      (generation.checkpoint !== null || ruleSets.length === meta.ruleSetCount), 'Checkpoint record counts do not match history');
    requireData(meta.asOf.timestamp >= generation.startedAt && (!generations[index + 1] ||
      canonical(meta.asOf) === canonical(generations[index + 1]!.boundary)), 'Checkpoint conflicts with reset boundary');
    requireData(meta.highestRankAchieved.achievedAt >= generation.startedAt, 'Rank achievement predates its progression generation');
    const state: ProgressionState = {
      schemaVersion: meta.schemaVersion, asOf: meta.asOf, settledThroughDate: meta.settledThroughDate,
      activeRulesVersion: meta.activeRulesVersion, occasions: meta.occasions, highestRankAchieved: meta.highestRankAchieved,
      currentProgressionCenti: meta.currentProgressionCenti, ruleSets: generationRules, sessions, awards,
      lifetimeXpCenti: awards.reduce((total, award) => integer(total + award.xpCenti), 0),
      totalMeditationSeconds: sessions.reduce((total, entry) => integer(total + entry.session.activeDurationSeconds), 0),
      ...(consistencyActivations.length ? { consistencyActivations } : {}),
    };
    for (const activation of consistencyActivations) validateConsistencyActivation(activation, state);
    validateIntegrity(state);
    const legacyRow = legacyPeaks.find((value) => object(value).generation_id === generation.id);
    const legacy = legacyRow ? validateJourneyAchievement(legacyRow, state, generation.id, generation.startedAt) : null;
    if (generation.journey !== null) validateJourneyAchievement(generation.journey, state, generation.id, generation.startedAt, legacy);
    // Same validated cursor: no decay or earnings replay. Domain detaches/freezes the loaded state.
    return { generation, state: advanceProgression(state, state.asOf) };
    });
    return states;
  } catch (cause) {
    if (cause instanceof PersistenceError) throw cause;
    throw new PersistenceError('INVALID_DATA', 'Could not restore progression safely', { cause });
  }
}

export async function loadState(sql: SqlConnection, registry: RulesRegistry): Promise<ProgressionState> {
  return (await loadGenerationStates(sql, registry)).at(-1)!.state;
}

export async function writeCheckpoint(sql: SqlConnection, state: ProgressionState): Promise<void> {
  await sql.run(`INSERT INTO progression_checkpoint(id, current_progression_centi, metadata_json) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET current_progression_centi = excluded.current_progression_centi, metadata_json = excluded.metadata_json`,
  [state.currentProgressionCenti, JSON.stringify(checkpointMetadata(state))]);
}

/** Persist only newly appended ledger entries; SQL triggers forbid changes to historical entries. */
export async function appendTransition(sql: SqlConnection, before: ProgressionState | null, after: ProgressionState, createdAt: number): Promise<void> {
  const generation = await currentGeneration(sql);
  const sequence = async (table: 'meditation_sessions' | 'progression_awards') =>
    integer(object((await sql.all(`SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM ${table}`))[0]).next, 1);
  for (let i = before?.ruleSets.length ?? 0; i < after.ruleSets.length; i++) {
    const rules = after.ruleSets[i]!;
    await sql.run('INSERT INTO progression_rules(version, sequence, rules_json) VALUES (?, ?, ?)', [rules.version, i + 1, JSON.stringify(rules)]);
  }
  for (const activation of (after.consistencyActivations ?? []).slice(before?.consistencyActivations?.length ?? 0)) {
    await sql.run('INSERT INTO progression_consistency_activations(generation_id, rules_version, activation_json) VALUES (?, ?, ?)',
      [generation.id, activation.rulesVersion, JSON.stringify(activation)]);
  }
  for (let i = before?.sessions.length ?? 0; i < after.sessions.length; i++) {
    const entry = after.sessions[i]!;
    const s = entry.session;
    await sql.run(`INSERT INTO meditation_sessions(id, sequence, started_at, ended_at, active_seconds, paused_seconds,
      status, local_date, time_zone, created_at, qualified, qualification_rules_version, generation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.id, await sequence('meditation_sessions'), s.startedAt, s.endedAt, s.activeDurationSeconds, s.pausedDurationSeconds, s.status, s.localDate, s.timeZone,
      createdAt, entry.qualified ? 1 : 0, entry.qualificationRulesVersion, generation.id]);
  }
  for (let i = before?.awards.length ?? 0; i < after.awards.length; i++) {
    const a = after.awards[i]!;
    await sql.run(`INSERT INTO progression_awards(id, sequence, session_id, occasion_id, rules_version, awarded_at,
      local_date, reward_date, xp_centi, breakdown_json, generation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, await sequence('progression_awards'), a.sessionId, a.occasionId, a.rulesVersion, a.awardedAt, a.localDate, a.rewardDate, a.xpCenti, JSON.stringify(a.breakdown), generation.id]);
  }
  await writeCheckpoint(sql, after);
}
