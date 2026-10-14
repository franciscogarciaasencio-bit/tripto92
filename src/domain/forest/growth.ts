/** Forest growth is a presentation of achievements, never another reward balance. */
export interface ForestStage {
  readonly id: string;
  readonly name: string;
  readonly minimumLevel: number;
}
export interface ForestGrowthRules {
  readonly version: string;
  readonly basis: 'highest' | 'current';
  readonly stages: readonly ForestStage[];
}
export const FOREST_GROWTH_V1: ForestGrowthRules = Object.freeze({
  version: 'ona_forest_growth_v1',
  basis: 'highest',
  // Six supplied coast images: one starting landscape and five growth stages.
  // These visual milestones can change without altering Ripples or saved achievements.
  stages: Object.freeze([
    { id: 'coast_0', name: 'First roots', minimumLevel: 0 },
    { id: 'coast_1', name: 'Little grove', minimumLevel: 1 },
    { id: 'coast_2', name: 'Growing grove', minimumLevel: 20 },
    { id: 'coast_3', name: 'Quiet canopy', minimumLevel: 40 },
    { id: 'coast_4', name: 'Coastal woodland', minimumLevel: 65 },
    { id: 'coast_5', name: 'Living forest', minimumLevel: 100 },
  ].map(stage => Object.freeze(stage))),
});

export function getForestStage(progress: { readonly highestLevel: number; readonly currentLevel: number },
  rules: ForestGrowthRules = FOREST_GROWTH_V1): ForestStage {
  for (const level of [progress.highestLevel, progress.currentLevel]) {
    if (!Number.isSafeInteger(level) || level < 0 || level > 125) throw new RangeError('Invalid forest level');
  }
  if (progress.currentLevel > progress.highestLevel) throw new RangeError('Current level exceeds historical achievement');
  if (!rules.version || !['highest', 'current'].includes(rules.basis) || !rules.stages.length)
    throw new RangeError('Invalid forest growth configuration');
  const ids = new Set<string>();
  let previous = -1;
  for (const stage of rules.stages) {
    if (!stage.id.trim() || ids.has(stage.id) || !stage.name.trim() || !Number.isSafeInteger(stage.minimumLevel)
      || stage.minimumLevel <= previous || stage.minimumLevel > 125)
      throw new RangeError('Invalid forest stage');
    ids.add(stage.id); previous = stage.minimumLevel;
  }
  if (rules.stages[0]!.minimumLevel !== 0) throw new RangeError('Forest must include a starting stage');
  const level = rules.basis === 'highest' ? progress.highestLevel : progress.currentLevel;
  return rules.stages.filter(stage => stage.minimumLevel <= level).at(-1)!;
}
