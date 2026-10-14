import { settleTimer, type TimerDraft } from '../domain/meditation/timer';

/** A durable practice takes priority over a restored route or an incoming link. */
export function requiredPracticeRoute(phase: TimerDraft['phase'] | null, hasCompletion: boolean) {
  if (hasCompletion || phase === 'finished') return '/completion';
  return phase ? '/session' : null;
}

interface DeadlineClock {
  now(): number;
  timeZone(): string;
  schedule(callback: () => void, milliseconds: number): () => void;
}

/** One deadline for legacy timed cursors. Open-ended practice needs no polling.
 * Recreate after resume/foreground/unlock; a deadline already passed uses its captured zone.
 * This only requests completion: the provider still owns locking and durable saves.
 */
export function watchTimerDeadline(draft: TimerDraft | null, clock: DeadlineClock,
  complete: (finished: TimerDraft) => void, fail: (error: unknown) => void) {
  let cancelled = false, delivered = false, cancelNext = () => {};
  if (draft?.phase === 'running' && draft.targetSeconds !== null) {
    const deadline = draft.changedAt + draft.targetSeconds * 1000 - draft.activeMilliseconds;
    const unattended = clock.now() >= deadline;
    const check = () => {
      if (cancelled || delivered) return;
      try {
        const now = clock.now();
        const finished = settleTimer(draft, now, unattended ? draft.timeZone : clock.timeZone());
        if (finished.phase === 'finished') {
          delivered = true;
          complete(finished);
        } else cancelNext = clock.schedule(check, Math.max(1, deadline - now));
      } catch (error) { delivered = true; fail(error); }
    };
    check();
  }
  return () => { cancelled = true; cancelNext(); };
}
