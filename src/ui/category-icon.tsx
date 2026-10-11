import Svg, { Path } from 'react-native-svg';
import icons from '../../assets/ona/categories.json';
import type { JourneyCategory } from '@/domain/progression';
import { colors } from './primitives';

export function CategoryIcon({ category, size = 28 }: { category: JourneyCategory; size?: number }) {
  const icon = icons.find((candidate) => candidate.id === category.iconId);
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image" accessibilityLabel={`${category.name} icon`}>
    {icon?.paths.map((path, index) => <Path key={index} d={path} fill="none" stroke={colors.ink} strokeWidth={1.35}
      strokeLinecap="round" strokeLinejoin="round" />)}
  </Svg>;
}
