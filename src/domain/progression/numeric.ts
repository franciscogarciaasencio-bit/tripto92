/** Persisted XP is integer hundredths. Basis points are integer ten-thousandths. */
export const CENTI_XP_PER_XP = 100;
export const BASIS_POINTS = 10_000;

export function assertNonnegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a nonnegative safe integer`);
  }
}

export function safeAdd(a: number, b: number): number {
  const result = a + b;
  assertNonnegativeInteger(result, 'sum');
  return result;
}

/** Exact integer multiplication/division, with half-cent ties rounded upward. */
export function multiplyRatio(value: number, numerator: number, denominator: number, ceil = false): number {
  assertNonnegativeInteger(value, 'value');
  assertNonnegativeInteger(numerator, 'numerator');
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new RangeError('denominator must be a positive safe integer');
  }
  const product = BigInt(value) * BigInt(numerator);
  const divisor = BigInt(denominator);
  const rounded = ceil
    ? (product + divisor - 1n) / divisor
    : (2n * product + divisor) / (2n * divisor);
  const result = Number(rounded);
  assertNonnegativeInteger(result, 'rounded result');
  return result;
}

/** Detach mutable JSON data before freezing; never freeze a caller's own objects. */
export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    const copy = Array.isArray(value)
      ? value.map((child: unknown) => freeze(child))
      : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)]));
    return Object.freeze(copy) as T;
  }
  return value;
}
