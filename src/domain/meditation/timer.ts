import type { MeditationSession } from './session';
import { validateSession } from './session';

/** Durable timer cursor. Milliseconds retain partial seconds across any number of pauses. */
export interface TimerDraft {
  readonly id: string;
  readonly startedAt: number;
  /** Start zone while pending; observed completion zone when finished. Unattended recovery keeps the captured start zone. */
  readonly timeZone: string;
  readonly targetSeconds: number;
  readonly phase: 'running' | 'paused' | 'finished';
  readonly changedAt: number;
  readonly activeMilliseconds: number;
  readonly pausedMilliseconds: number;
  readonly completionStatus: MeditationSession['status'] | null;
}

export function practiceContext(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'gregory',
  }).formatToParts(timestamp);
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return { timestamp, timeZone, localDate: `${part('year')}-${part('month')}-${part('day')}` };
}

export function validateTimer(draft: TimerDraft): void {
  if (!draft || typeof draft.id !== 'string' || !draft.id.trim()) throw new RangeError('Timer ID is required');
  if (typeof draft.timeZone !== 'string' || !draft.timeZone.trim()) throw new RangeError('Timer time zone is required');
  for (const value of [draft.startedAt, draft.changedAt, draft.activeMilliseconds, draft.pausedMilliseconds]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid timer timestamp or duration');
  }
  if (!Number.isSafeInteger(draft.targetSeconds) || draft.targetSeconds < 1 || draft.targetSeconds > 10_800) {
    throw new RangeError('Timer duration must be 1–180 minutes');
  }
  if (!['running', 'paused', 'finished'].includes(draft.phase)) throw new RangeError('Invalid timer phase');
  if (draft.changedAt < draft.startedAt || draft.activeMilliseconds + draft.pausedMilliseconds !== draft.changedAt - draft.startedAt ||
      draft.activeMilliseconds > draft.targetSeconds * 1000) throw new RangeError('Inconsistent timer cursor');
  if (draft.phase === 'finished') {
    if (!['completed', 'ended_early'].includes(draft.completionStatus ?? '')) throw new RangeError('Missing completion status');
    if ((draft.completionStatus === 'completed') !== (draft.activeMilliseconds === draft.targetSeconds * 1000)) {
      throw new RangeError('Completion status does not match timer activity');
    }
  } else if (draft.completionStatus !== null || draft.activeMilliseconds >= draft.targetSeconds * 1000) {
    throw new RangeError('Unfinished timer is inconsistent');
  }
  practiceContext(draft.changedAt, draft.timeZone); // Reject unknown zones explicitly.
}

export function startTimer(id: string, targetSeconds: number, timestamp: number, timeZone: string): TimerDraft {
  const draft: TimerDraft = { id, targetSeconds, startedAt: timestamp, timeZone, changedAt: timestamp,
    activeMilliseconds: 0, pausedMilliseconds: 0, phase: 'running', completionStatus: null };
  validateTimer(draft);
  return draft;
}

function elapsed(draft: TimerDraft, now: number) {
  validateTimer(draft);
  if (!Number.isSafeInteger(now) || now < draft.changedAt) throw new RangeError('Device clock moved backwards');
  return now - draft.changedAt;
}

/** Background/terminated running sessions finish at their deadline, never at the later reopening time. */
export function settleTimer(draft: TimerDraft, now: number, completionTimeZone = draft.timeZone): TimerDraft {
  const delta = elapsed(draft, now);
  if (draft.phase !== 'running' || draft.activeMilliseconds + delta < draft.targetSeconds * 1000) return draft;
  practiceContext(draft.changedAt + draft.targetSeconds * 1000 - draft.activeMilliseconds, completionTimeZone);
  return { ...draft, timeZone: completionTimeZone, phase: 'finished', completionStatus: 'completed',
    changedAt: draft.changedAt + draft.targetSeconds * 1000 - draft.activeMilliseconds,
    activeMilliseconds: draft.targetSeconds * 1000 };
}

export function pauseTimer(draft: TimerDraft, now: number, completionTimeZone = draft.timeZone): TimerDraft {
  const settled = settleTimer(draft, now, completionTimeZone);
  if (settled.phase !== 'running') return settled;
  return { ...settled, phase: 'paused', changedAt: now,
    activeMilliseconds: settled.activeMilliseconds + elapsed(settled, now) };
}

export function resumeTimer(draft: TimerDraft, now: number): TimerDraft {
  const delta = elapsed(draft, now);
  if (draft.phase !== 'paused') return settleTimer(draft, now);
  return { ...draft, phase: 'running', changedAt: now, pausedMilliseconds: draft.pausedMilliseconds + delta };
}

export function finishTimer(draft: TimerDraft, now: number, completionTimeZone = draft.timeZone): TimerDraft {
  const settled = settleTimer(draft, now, completionTimeZone);
  if (settled.phase === 'finished') return settled;
  const delta = elapsed(settled, now);
  practiceContext(now, completionTimeZone);
  return { ...settled, timeZone: completionTimeZone, phase: 'finished', completionStatus: 'ended_early', changedAt: now,
    activeMilliseconds: settled.activeMilliseconds + (settled.phase === 'running' ? delta : 0),
    pausedMilliseconds: settled.pausedMilliseconds + (settled.phase === 'paused' ? delta : 0) };
}

export function remainingSeconds(draft: TimerDraft, now: number): number {
  const delta = elapsed(draft, now);
  return Math.max(0, Math.ceil((draft.targetSeconds * 1000 - draft.activeMilliseconds -
    (draft.phase === 'running' ? delta : 0)) / 1000));
}

export function timerSession(draft: TimerDraft): MeditationSession {
  validateTimer(draft);
  if (draft.phase !== 'finished' || draft.completionStatus === null) throw new RangeError('Timer must be finished before saving');
  const context = practiceContext(draft.changedAt, draft.timeZone);
  const session: MeditationSession = { id: draft.id, startedAt: draft.startedAt, endedAt: draft.changedAt,
    activeDurationSeconds: Math.floor(draft.activeMilliseconds / 1000),
    pausedDurationSeconds: Math.floor(draft.pausedMilliseconds / 1000), status: draft.completionStatus,
    localDate: context.localDate, timeZone: context.timeZone };
  validateSession(session);
  return session;
}
