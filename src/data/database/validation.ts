import { PersistenceError } from './errors';

export function requireData(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PersistenceError('INVALID_DATA', message);
}
export function object(value: unknown): Record<string, unknown> {
  requireData(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected an object');
  return value as Record<string, unknown>;
}
export function text(value: unknown): string {
  requireData(typeof value === 'string' && value.trim().length > 0, 'Expected a nonempty string');
  return value;
}
export function integer(value: unknown, minimum = 0): number {
  requireData(typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum, 'Expected a safe integer');
  return value;
}
export function timestamp(value: unknown): number {
  const result = integer(value);
  requireData(result <= 8_640_000_000_000_000, 'Timestamp is outside Date range');
  return result;
}
export function localDate(value: unknown): string {
  const result = text(value);
  requireData(/^\d{4}-\d{2}-\d{2}$/.test(result) && result >= '0001-01-01', 'Invalid local date');
  const date = new Date(`${result}T00:00:00Z`);
  requireData(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === result, 'Invalid calendar date');
  return result;
}
export function timeZone(value: unknown): string {
  const result = text(value);
  // Check identifier syntax, not today's device ICU/tzdb. Never remap historical dates.
  requireData(/^[A-Za-z][A-Za-z0-9_+.-]*(\/[A-Za-z0-9_+.-]+)*$/.test(result), 'Invalid captured time-zone identifier');
  return result;
}
export function array<T>(value: unknown, decode: (item: unknown) => T): T[] {
  requireData(Array.isArray(value), 'Expected an array');
  return value.map(decode);
}
export function json(value: unknown): unknown {
  try { return JSON.parse(text(value)) as unknown; }
  catch (cause) { throw new PersistenceError('INVALID_DATA', 'Invalid stored JSON', { cause }); }
}
/** Object key order is not part of a record's meaning. Array order is. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}
