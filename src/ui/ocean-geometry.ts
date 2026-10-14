/** Visual constants only; this clock never measures meditation time. */
export const OCEAN_CYCLE_MS = 12_000;
export const OCEAN_REDUCED_AMPLITUDE = 0.5;
export const OCEAN_VIEWBOX = '0 660 932 360';
// A restrained 10% increase from the previous 41.6/33.8 swell; native deformation is unchanged.
export const OCEAN_AMPLITUDES = { dark: 45.76, light: 37.18 } as const;
export type OceanPoint = readonly [number, number];

/** Periodic travelling lift; local displacements differ, so this is deformation rather than translation. */
export function oceanLift(x: number, phase: number, amplitude: number, scale: number) {
  'worklet';
  const position = x / 932;
  const envelope = .55 + .45 * Math.sin(position * Math.PI);
  return Math.sin(phase - position * .8) * amplitude * envelope * scale;
}

/** Catmull–Rom cubics preserve the supplied contour and its continuous tangents. */
export function oceanPath(nodes: readonly OceanPoint[], phase: number, amplitude: number, scale: number) {
  'worklet';
  if (nodes.length < 2) throw new RangeError('A wave needs at least two contour points');
  const points: OceanPoint[] = nodes.map(([x, y]) => [x, y + oceanLift(x, phase, amplitude, scale)]);
  let d = `M ${points[0]![0]} ${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    // Length guard, loop bounds and clamped neighbours guarantee these entries exist.
    const a = points[Math.max(0, i - 1)]!, b = points[i]!, c = points[i + 1]!, e = points[Math.min(points.length - 1, i + 2)]!;
    d += ` C ${b[0] + (c[0] - a[0]) / 6} ${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6} ${c[1] - (e[1] - b[1]) / 6} ${c[0]} ${c[1]}`;
  }
  return d;
}
