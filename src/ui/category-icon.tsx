import { Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { JourneyCategory } from '@/domain/progression';
import { colors } from './primitives';
import { CATEGORY_ICON_STYLE, getCategoryIconPaths, getCategoryPresentation, getLevelCategoryPresentation } from './category-presentation';
import { getStageArt } from './stage-art';

/** A stage's watercolour painting; stages without one yet fall back to their line symbol. */
export function CategoryIcon({ category, size = 28, level }: { category: JourneyCategory; size?: number; level?: number }) {
  const presentation = level === undefined ? getCategoryPresentation(category) : getLevelCategoryPresentation({ category, number: level });
  const art = getStageArt(category.id);
  if (art) return <Image source={art} accessibilityRole="image" accessibilityLabel={`${presentation.name} illustration`}
    resizeMode="contain" style={{ width: size, height: size }} />;
  return <Svg width={size} height={size} viewBox={CATEGORY_ICON_STYLE.viewBox} accessibilityRole="image" accessibilityLabel={`${presentation.name} icon`}>
    {getCategoryIconPaths(category, level).map((path, index) => <Path key={index} d={path} fill="none" stroke={colors.ink} strokeWidth={CATEGORY_ICON_STYLE.strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" />)}
  </Svg>;
}
