import type { MeditationSession } from './session';
import { validateSession } from './session';

/** Durable timer cursor. Milliseconds retain partial seconds across any number of pauses. */
export interface TimerDraft {
  readonly id: string;
  readonly startedAt: number;
  /** Start zone while pending; observed completion zone when finished. Unattended recovery keeps the captured start zone. */
  readonly timeZone: string;
  /**
   * open_ended: no target; Finish completes. fixed: a chosen duration that ends by itself, and
   * finishing earlier is still the person's completed practice. timed: legacy cursors from
   * earlier releases, where finishing before the target was recorded as ended_early.
   */
  readonly mode: 'timed' | 'open_ended' | 'fixed';
  readonly targetSeconds: number | null;
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
  if (!['timed', 'open_ended', 'fixed'].includes(draft.mode)) throw new RangeError('Invalid timer mode');
  if (draft.mode === 'open_ended' ? draft.targetSeconds !== null :
      (draft.targetSeconds === null || !Number.isSafeInteger(draft.targetSeconds) || draft.targetSeconds < 1 || draft.targetSeconds > 10_800)) {
    throw new RangeError('Timer duration must be 1–180 minutes');
  }
  if (!['running', 'paused', 'finished'].includes(draft.phase)) throw new RangeError('Invalid timer phase');
  if (draft.changedAt < draft.startedAt || draft.activeMilliseconds + draft.pausedMilliseconds !== draft.changedAt - draft.startedAt ||
      (draft.targetSeconds !== null && draft.activeMilliseconds > draft.targetSeconds * 1000)) throw new RangeError('Inconsistent timer cursor');
  if (draft.phase === 'finished') {
    if (!['completed', 'ended_early'].includes(draft.completionStatus ?? '')) throw new RangeError('Missing completion status');
    if (draft.mode !== 'timed' ? draft.completionStatus !== 'completed' :
        ((draft.completionStatus === 'completed') !== (draft.activeMilliseconds === (draft.targetSeconds ?? 0) * 1000))) {
      throw new RangeError('Completion status does not match timer activity');
    }
  } else if (draft.completionStatus !== null || (draft.targetSeconds !== null && draft.activeMilliseconds >= draft.targetSeconds * 1000)) {
    throw new RangeError('Unfinished timer is inconsistent');
  }
  practiceContext(draft.changedAt, draft.timeZone); // Reject unknown zones explicitly.
}

export function startTimer(id: string, targetSeconds: number, timestamp: number, timeZone: string): TimerDraft {
  const draft: TimerDraft = { id, mode: 'timed', targetSeconds, startedAt: timestamp, timeZone, changedAt: timestamp,
    activeMilliseconds: 0, pausedMilliseconds: 0, phase: 'running', completionStatus: null };
  validateTimer(draft);
  return draft;
}

/** A chosen duration (1–180 minutes) that finishes by itself; finishing earlier also completes it. */
export function startFixedTimer(id: string, targetSeconds: number, timestamp: number, timeZone: string): TimerDraft {
  const draft: TimerDraft = { id, mode: 'fixed', targetSeconds, startedAt: timestamp, timeZone, changedAt: timestamp,
    activeMilliseconds: 0, pausedMilliseconds: 0, phase: 'running', completionStatus: null };
  validateTimer(draft);
  return draft;
}

/** No target or automatic expiry. Only an explicit Finish creates a completed session. */
export function startOpenEndedTimer(id: string, timestamp: number, timeZone: string): TimerDraft {
  const draft: TimerDraft = { id, mode: 'open_ended', targetSeconds: null, startedAt: timestamp, timeZone,
    changedAt: timestamp, activeMilliseconds: 0, pausedMilliseconds: 0, phase: 'running', completionStatus: null };
  validateTimer(draft);
  return draft;
}

function elapsed(draft: TimerDraft, now: number) {
  validateTimer(draft);
  if (!Number.isSafeInteger(now) || now < draft.changedAt) throw new RangeError('Device clock moved backwards');
  return now - draft.changedAt;
}

/** Legacy timed sessions finish at their deadline; open-ended sessions retain their running cursor. */
export function settleTimer(draft: TimerDraft, now: number, completionTimeZone = draft.timeZone): TimerDraft {
  const delta = elapsed(draft, now);
  if (draft.targetSeconds === null || draft.phase !== 'running' || draft.activeMilliseconds + delta < draft.targetSeconds * 1000) return draft;
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
  return { ...settled, timeZone: completionTimeZone, phase: 'finished', completionStatus: settled.mode === 'timed' ? 'ended_early' : 'completed', changedAt: now,
    activeMilliseconds: settled.activeMilliseconds + (settled.phase === 'running' ? delta : 0),
    pausedMilliseconds: settled.pausedMilliseconds + (settled.phase === 'paused' ? delta : 0) };
}

export function remainingSeconds(draft: TimerDraft, now: number): number {
  const delta = elapsed(draft, now);
  if (draft.targetSeconds === null) throw new RangeError('Open-ended practice has no remaining time');
  return Math.max(0, Math.ceil((draft.targetSeconds * 1000 - draft.activeMilliseconds -
    (draft.phase === 'running' ? delta : 0)) / 1000));
}

export function activeElapsedSeconds(draft: TimerDraft, now: number): number {
  const delta = elapsed(draft, now);
  const active = draft.activeMilliseconds + (draft.phase === 'running' ? delta : 0);
  return Math.floor(Math.min(active, draft.targetSeconds === null ? active : draft.targetSeconds * 1000) / 1000);
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
