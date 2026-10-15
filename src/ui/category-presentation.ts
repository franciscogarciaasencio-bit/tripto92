import type { JourneyCategory, JourneyLevel } from '../domain/progression';
import visibleArtwork from './category-artwork.json';
import sealedArtwork from './category-sealed.json';

/** Presentation can evolve without renaming historical category or achievement IDs. */
export const CATEGORY_PRESENTATION_VERSION = 'ona_category_presentation_v3';
export const CATEGORY_ICON_STYLE = Object.freeze({ viewBox: '0 0 24 24', strokeWidth: 1.35 });

export interface CategoryPresentation {
  readonly version: typeof CATEGORY_PRESENTATION_VERSION;
  readonly id: string;
  readonly iconId: string;
  readonly name: string;
  readonly theme: string;
}

interface ArtworkEntry { readonly id: string; readonly name: string; readonly theme: string; readonly paths: readonly string[];
  readonly preludePaths?: readonly string[] }

/**
 * Sealed stages are discovered by reaching them, so their text and geometry are stored encoded
 * (base64 ASCII JSON; see scripts/sealed-categories.cjs). Sealed, not secret: never print them.
 */
const codec = globalThis as unknown as { atob(data: string): string; btoa(data: string): string };
const decodeBase64 = (data: string) => codec.atob(data);
/** Sealed paintings are stored XOR-veiled so the committed bytes are not a viewable image. */
export const STAGE_ART_VEIL = 'ona-stage-veil';
const sealedArt = new Map<string, string>();
/** Data URI of a sealed stage's painting, or null while that stage still uses its line symbol. */
export function getSealedStageArt(id: string): string | null {
  const cached = sealedArt.get(id);
  if (cached) return cached;
  const entry = (sealedArtwork as readonly { id: string; art?: string }[]).find((candidate) => candidate.id === id);
  if (!entry?.art) return null;
  const uri = unveilArt(entry.art);
  sealedArt.set(id, uri);
  return uri;
}
/** Veiled base64 → PNG data URI (the inverse of the XOR veil in scripts/sealed-categories.cjs). */
export function unveilArt(art: string): string {
  const veiled = codec.atob(art);
  const bytes: string[] = new Array(veiled.length);
  for (let index = 0; index < veiled.length; index++) {
    bytes[index] = String.fromCharCode(veiled.charCodeAt(index) ^ STAGE_ART_VEIL.charCodeAt(index % STAGE_ART_VEIL.length));
  }
  return `data:image/png;base64,${codec.btoa(bytes.join(''))}`;
}
export const isSealedStage = (id: string) => (sealedArtwork as readonly { id: string }[]).some((entry) => entry.id === id);
function unseal(id: string): ArtworkEntry {
  const entry = sealedArtwork.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('Missing sealed journey stage');
  const value = JSON.parse(decodeBase64(entry.data)) as { name: string; theme: string; paths: string[] };
  return { id, name: value.name, theme: value.theme, paths: value.paths };
}
const artwork: readonly ArtworkEntry[] = (visibleArtwork as readonly (Partial<ArtworkEntry> & { id: string; sealed?: boolean })[])
  .map((entry) => entry.sealed ? unseal(entry.id) : entry as ArtworkEntry);

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
