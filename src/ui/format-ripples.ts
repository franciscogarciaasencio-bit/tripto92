/** Whole-number presentation only; domain/storage retain exact centi-Ripples. */
export function formatRipples(centi: number): string {
  return Math.round(centi / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
