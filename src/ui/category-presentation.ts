import type { JourneyCategory, JourneyLevel } from '../domain/progression';
import artwork from './category-artwork.json';

/** Presentation can evolve without renaming historical category or achievement IDs. */
export const CATEGORY_PRESENTATION_VERSION = 'ona_category_presentation_v2';
export const CATEGORY_ICON_STYLE = Object.freeze({ viewBox: '0 0 24 24', strokeWidth: 1.35 });

export interface CategoryPresentation {
  readonly version: typeof CATEGORY_PRESENTATION_VERSION;
  readonly id: string;
  readonly iconId: string;
  readonly name: string;
  readonly theme: string;
}

const presentations = new Map<string, CategoryPresentation>();
const paths = new Map<string, readonly string[]>();
for (const entry of artwork) {
  presentations.set(entry.id, Object.freeze({ version: CATEGORY_PRESENTATION_VERSION,
    id: entry.id, iconId: entry.id, name: entry.name, theme: entry.theme }));
  paths.set(entry.id, Object.freeze([...entry.paths]));
}
const preludeArtwork = artwork.find((entry) => entry.id === 'monkey_mind');
if (!preludeArtwork?.preludePaths) throw new Error('Missing Monkey Mind prelude artwork');
const preludePaths = Object.freeze([...preludeArtwork.preludePaths]);
const preludePresentation: CategoryPresentation = Object.freeze({
  ...getCategoryPresentation('monkey_mind'), name: 'Monkey Mind', theme: 'Beginning amid the chatter.',
});

function categoryId(category: JourneyCategory | string): string {
  return typeof category === 'string' ? category : category.id;
}

/** Resolve by stable ID, including records saved with a previous display name. */
export function getCategoryPresentation(category: JourneyCategory | string): CategoryPresentation {
  const presentation = presentations.get(categoryId(category));
  if (!presentation) throw new RangeError('Unknown journey category');
  return presentation;
}

/** The editable SVG exports and native component share these exact source paths. */
export function getCategoryIconPaths(category: JourneyCategory | string, level?: number): readonly string[] {
  if (level === 0 && categoryId(category) === 'monkey_mind') return preludePaths;
  const geometry = paths.get(categoryId(category));
  if (!geometry) throw new RangeError('Unknown journey category');
  return geometry;
}

/** The prelude is outside the 25 numbered five-level categories. */
export function getLevelCategoryPresentation(level: Pick<JourneyLevel, 'number' | 'category'>): CategoryPresentation {
  const current = getCategoryPresentation(level.category);
  return level.number === 0 && current.id === 'monkey_mind' ? preludePresentation : current;
}

export function getJourneyPresentationLabel(level: JourneyLevel): string {
  const { name } = getLevelCategoryPresentation(level);
  return level.number === 0 ? `Level 0 · ${name}`
    : `Level ${level.number} · ${name} · ${level.categoryStep} of 5`;
}
