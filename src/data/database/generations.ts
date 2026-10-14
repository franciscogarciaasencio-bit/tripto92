import type { SqlConnection } from './connection';
import { decodeContext } from './decoders';
import { integer, json, object, requireData, timestamp } from './validation';

/** Local monotonic ordinals partition progression, while stable session/award IDs remain global. */
export async function loadGenerations(sql: SqlConnection) {
  const rows = await sql.all('SELECT * FROM progression_generations ORDER BY id');
  requireData(rows.length > 0, 'Progression generation is missing');
  let previousStart = 0;
  return rows.map((value, index) => {
    const row = object(value);
    const id = integer(row.id, 1), startedAt = timestamp(row.started_at);
    requireData(id === index + 1 && startedAt >= previousStart, 'Invalid progression generation order');
    previousStart = startedAt;
    const boundary = row.boundary_json === null ? null : decodeContext(json(row.boundary_json));
    requireData((id === 1 && startedAt === 0 && boundary === null) || boundary?.timestamp === startedAt,
      'Invalid progression reset boundary');
    const closed = row.closed_checkpoint_json !== null;
    requireData(closed === (index < rows.length - 1) && closed === (row.closed_progression_centi !== null) &&
      closed === (row.closed_journey_json !== null), 'Invalid closed progression generation');
    return { id, startedAt, boundary,
      checkpoint: closed ? { metadata_json: row.closed_checkpoint_json, current_progression_centi: row.closed_progression_centi } : null,
      journey: closed ? json(row.closed_journey_json) : null };
  });
}

export async function currentGeneration(sql: SqlConnection) {
  return (await loadGenerations(sql)).at(-1)!;
}

/** Full deletion reuses generation 1 with an exclusive boundary, rejecting same-millisecond stale cursors. */
export function permitsPracticeStart(generation: Awaited<ReturnType<typeof currentGeneration>>, startedAt: number) {
  return generation.id === 1 && generation.boundary !== null ? startedAt > generation.startedAt : startedAt >= generation.startedAt;
}
