import type { MeditationSession } from '../domain/progression';

interface PracticeRecord { readonly session: MeditationSession }

export interface PracticeDay<T extends PracticeRecord> {
  readonly key: string;
  readonly data: readonly T[];
  readonly activeSeconds: number;
}

/** Group by the captured day, never by the device's current time zone. Preserve repository order within each day. */
export function groupPracticeHistory<T extends PracticeRecord>(records: readonly T[]): PracticeDay<T>[] {
  const days = new Map<string, T[]>();
  for (const record of records) {
    const day = record.session.localDate;
    const group = days.get(day) ?? [];
    group.push(record);
    days.set(day, group);
  }
  return [...days].sort(([a], [b]) => a > b ? -1 : a < b ? 1 : 0)
    .map(([key, data]) => ({ key, data, activeSeconds: data.reduce((sum, { session }) => sum + session.activeDurationSeconds, 0) }));
}

/** Read-only summary including short sessions; these are not qualifying Consistency days. */
export function monthPracticeSummary(records: readonly PracticeRecord[], month: string) {
  const days = new Set<string>();
  let practices = 0, activeSeconds = 0;
  for (const { session } of records) {
    if (!session.localDate.startsWith(`${month}-`)) continue;
    days.add(session.localDate);
    ++practices;
    activeSeconds += session.activeDurationSeconds;
  }
  return { practices, practiceDays: days.size, activeSeconds };
}

/** Defensive page merging for presentation only; it never imports or issues rewards. */
export function appendHistoryPage<T extends PracticeRecord>(records: readonly T[], page: readonly T[]) {
  const ids = new Set(records.map(({ session }) => session.id));
  const result = [...records];
  for (const record of page) {
    if (ids.has(record.session.id)) continue;
    ids.add(record.session.id);
    result.push(record);
  }
  return result;
}

export function practiceDateLabel(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' })
    .format(new Date(`${day}T00:00:00.000Z`));
}

/** Historical local time; never fall back to today's device zone if an old identifier is unavailable. */
export function practiceClockLabel(timestamp: number, timeZone: string): string | null {
  try { return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(timestamp); }
  catch { return null; }
}

/** Compact active-time summary; less than one minute is visible rather than rounded away. */
export function practiceTimeLabel(seconds: number) {
  if (seconds === 0) return '0 min';
  if (seconds < 60) return '<1 min';
  const minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${minutes} min`;
}
