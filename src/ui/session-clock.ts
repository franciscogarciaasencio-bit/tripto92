import { activeElapsedSeconds, type TimerDraft } from '../domain/meditation/timer';

interface DisplayClock {
  now(): number;
  schedule(callback: () => void, milliseconds: number): () => void;
}

/** Display only. Align to active-second boundaries; never save or advance a timer cursor. */
export function startSessionClock(draft: TimerDraft, clock: DisplayClock, publish: (seconds: number) => void) {
  let cancelled = false, last: number | null = null, cancelNext = () => {};
  const tick = () => {
    if (cancelled) return;
    const now = Math.max(draft.changedAt, clock.now());
    const seconds = activeElapsedSeconds(draft, now);
    if (seconds !== last) { last = seconds; publish(seconds); }
    if (draft.phase === 'running' && !cancelled) {
      const active = draft.activeMilliseconds + now - draft.changedAt;
      cancelNext = clock.schedule(tick, 1000 - active % 1000);
    }
  };
  tick();
  return () => { cancelled = true; cancelNext(); };
}
