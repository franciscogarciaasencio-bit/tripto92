import { assertNonnegativeInteger } from './numeric';

/** A caller-captured Gregorian date, never interpreted in the device's time zone. */
export type LocalDate = string;

export interface CalendarContext {
  /** UTC Unix milliseconds. */
  readonly timestamp: number;
  readonly localDate: LocalDate;
  /** Captured IANA identifier; the caller, not this domain, performs zone conversion. */
  readonly timeZone: string;
}

const MILLISECONDS_PER_DAY = 86_400_000;

export function dayNumber(date: LocalDate): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('localDate must be YYYY-MM-DD');
  const instant = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Invalid calendar date: ${date}`);
  }
  return instant / MILLISECONDS_PER_DAY;
}

export function dateFromDay(day: number): LocalDate {
  return new Date(day * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

export function validateContext(context: CalendarContext): void {
  assertNonnegativeInteger(context.timestamp, 'timestamp');
  if (context.timestamp > 8_640_000_000_000_000) throw new RangeError('timestamp is outside Date range');
  dayNumber(context.localDate);
  if (context.localDate < '0001-01-01') throw new RangeError('Calendar context must use a positive Gregorian year');
  if (typeof context.timeZone !== 'string' || context.timeZone.trim().length === 0) {
    throw new RangeError('A captured timeZone identifier is required');
  }
}

/**
 * Settlement never rewinds. A requested moment earlier than the stored one (a device clock that
 * stepped back, or a checkpoint synced from a phone whose clock runs ahead) settles at the stored
 * moment itself, date included, so every later replay of history reproduces it exactly. For any
 * request at or after the stored moment this is the identity: released histories are unaffected.
 */
export function forwardOnly(stored: CalendarContext, requested: CalendarContext): CalendarContext {
  return requested.timestamp >= stored.timestamp ? requested : stored;
}

/** The moment to read progress at: the device's present, or the stored settlement when the clock is behind. */
export const readingContext = forwardOnly;

export function precedingActiveDays(dates: readonly LocalDate[], today: LocalDate, window: number): number {
  const end = dayNumber(today);
  return new Set(dates.filter((date) => {
    const day = dayNumber(date);
    return day >= end - window && day < end;
  })).size;
}
