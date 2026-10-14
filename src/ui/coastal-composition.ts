/** Landmarks in the supplied, unchanged Forest 2 / 1.png (853 × 1844). */
export const COASTAL_ARTWORK = { width: 853, height: 1844, haloCenterX: 426, haloCenterY: 751,
  innerSunDiameter: 537, shorelineBottom: 1390, paperTop: 1450 } as const;

/** Uniform image scaling keeps the sun circular and every shoreline pixel above the independent wave band. */
export function coastalComposition(width: number, height: number, fontScale: number, bottomInset: number) {
  const canvasWidth = Math.min(width, 540), scale = canvasWidth / 377;
  const reservedFooter = 69 * scale + Math.max(bottomInset, 16 * scale);
  const progressionSpace = (fontScale > 1.3 ? 230 * fontScale : 115) * scale;
  // The taller replacement has more shoreline below its sun. Small phones/large type
  // scroll the scene rather than shrink or distort the artwork into the controls.
  const minimumContentHeight = (500 + 96 + 32 + Math.max(0, fontScale - 1) * 100) * scale + progressionSpace;
  const contentHeight = Math.max(height - reservedFooter, minimumContentHeight);
  const progressionTop = contentHeight - progressionSpace - 16 * scale;
  const waveHeight = 96 * scale, waveTop = progressionTop - waveHeight - 16 * scale;
  const artWidth = canvasWidth, imageScale = artWidth / COASTAL_ARTWORK.width;
  const artHeight = COASTAL_ARTWORK.height * imageScale;
  const artTop = Math.min(-24 * scale, waveTop - 18 * scale - COASTAL_ARTWORK.shorelineBottom * imageScale);
  const artLeft = (canvasWidth - artWidth) / 2;
  const haloCenterY = artTop + COASTAL_ARTWORK.haloCenterY * imageScale;
  const haloCenterX = artLeft + COASTAL_ARTWORK.haloCenterX * imageScale;
  const sunDiameter = COASTAL_ARTWORK.innerSunDiameter * imageScale;
  return { canvasWidth, scale, contentHeight, progressionTop, waveHeight, waveTop, artTop, artWidth, artHeight, artLeft,
    haloCenterY, haloCenterX, sunDiameter, sunLeft: haloCenterX - sunDiameter / 2, sunTop: haloCenterY - sunDiameter / 2 };
}
