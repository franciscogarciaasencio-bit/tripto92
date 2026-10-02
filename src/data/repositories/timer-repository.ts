import { validateTimer, type TimerDraft } from '../../domain/meditation/timer';
import type { SqlConnection, Transactions } from '../database/connection';
import { PersistenceError } from '../database/errors';
import { object, requireData, text } from '../database/validation';

function decodeDraft(input: unknown): TimerDraft {
  const value = object(input);
  // The domain validator checks every field; the cast does not make unchecked rows public.
  const draft = value as unknown as TimerDraft;
  try { validateTimer(draft); }
  catch (error) { throw new PersistenceError('INVALID_DATA', `Invalid timer draft: ${String(error)}`); }
  return { id: draft.id, startedAt: draft.startedAt, timeZone: draft.timeZone, targetSeconds: draft.targetSeconds,
    phase: draft.phase, changedAt: draft.changedAt, activeMilliseconds: draft.activeMilliseconds,
    pausedMilliseconds: draft.pausedMilliseconds, completionStatus: draft.completionStatus };
}

export async function loadTimer(sql: SqlConnection): Promise<TimerDraft | null> {
  const row = (await sql.all('SELECT draft_json FROM meditation_timer WHERE id = 1'))[0];
  if (!row) return null;
  try { return decodeDraft(JSON.parse(text(object(row).draft_json))); }
  catch (error) { throw new PersistenceError('INVALID_DATA', `Cannot restore timer: ${String(error)}`); }
}

export function createTimerRepository(database: Transactions) {
  return {
    load: () => database.transaction(loadTimer),
    async save(input: TimerDraft) {
      const draft = decodeDraft(input);
      return database.transaction(async (sql) => {
        const current = await loadTimer(sql);
        requireData(!current || current.id === draft.id, 'A meditation is already in progress');
        requireData(!current || draft.changedAt >= current.changedAt, 'Timer cursor cannot move backwards');
        if (current) {
          requireData(current.startedAt === draft.startedAt && current.targetSeconds === draft.targetSeconds,
            'Timer identity and duration cannot change');
          requireData(current.timeZone === draft.timeZone || (current.phase !== 'finished' && draft.phase === 'finished'),
            'Practice zone can only change when capturing completion');
          requireData(draft.activeMilliseconds >= current.activeMilliseconds && draft.pausedMilliseconds >= current.pausedMilliseconds,
            'Timer activity cannot move backwards');
          requireData(current.phase !== 'finished' || JSON.stringify(current) === JSON.stringify(draft), 'A pending completion cannot be edited');
        }
        await sql.run('INSERT INTO meditation_timer(id, draft_json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET draft_json = excluded.draft_json', [JSON.stringify(draft)]);
      });
    },
  };
}
