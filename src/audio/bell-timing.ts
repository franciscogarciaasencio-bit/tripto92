/** Ceilings of the acoustic PCM durations; verified against actual bundled samples.
 * These are resource watchdogs, not bell timing or meditation durations.
 * Native end events release normally; a short margin allows the complete resonance.
 */
export const BELL_DURATION_MS = { start: 13_241, end: 29_916 } as const;
export const BELL_RELEASE_MARGIN_MS = 1000;
