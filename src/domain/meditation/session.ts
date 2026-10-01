import { validateContext, type LocalDate } from '../progression/calendar';
import { assertNonnegativeInteger } from '../progression/numeric';

/** Finished timer runs, including early stops. Active time is measured, not inferred. */
export interface MeditationSession {
  readonly id: string;
  /** UTC Unix milliseconds. */
  readonly startedAt: number;
  readonly endedAt: number;
  readonly activeDurationSeconds: number;
  readonly pausedDurationSeconds: number;
  readonly status: 'completed' | 'ended_early';
  /** Date and zone captured at completion. They remain fixed after travel. */
  readonly localDate: LocalDate;
  readonly timeZone: string;
}

export function validateSession(session: MeditationSession): void {
  if (typeof session.id !== 'string' || session.id.trim().length === 0) throw new RangeError('session id is required');
  validateContext({ timestamp: session.endedAt, localDate: session.localDate, timeZone: session.timeZone });
  assertNonnegativeInteger(session.startedAt, 'startedAt');
  assertNonnegativeInteger(session.activeDurationSeconds, 'activeDurationSeconds');
  assertNonnegativeInteger(session.pausedDurationSeconds, 'pausedDurationSeconds');
  if (session.status !== 'completed' && session.status !== 'ended_early') throw new RangeError('session must be finished');
  const measured = session.activeDurationSeconds + session.pausedDurationSeconds;
  if (session.endedAt < session.startedAt || measured > (session.endedAt - session.startedAt) / 1000) {
    throw new RangeError('Active and paused durations must fit inside the session timestamps');
  }
}

export function sameSession(a: MeditationSession, b: MeditationSession): boolean {
  return a.id === b.id && a.startedAt === b.startedAt && a.endedAt === b.endedAt &&
    a.activeDurationSeconds === b.activeDurationSeconds && a.pausedDurationSeconds === b.pausedDurationSeconds &&
    a.status === b.status && a.localDate === b.localDate && a.timeZone === b.timeZone;
}
