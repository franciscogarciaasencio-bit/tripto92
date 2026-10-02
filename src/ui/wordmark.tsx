import Svg, { Path } from 'react-native-svg';
import lettering from '../../assets/ona/wordmark.json';
import { colors } from './primitives';

/** Editable vector letterforms: an asymmetric O and gently curved n/a, with a readable medium stroke. */
export function Wordmark() {
  return <Svg width={154} height={78} viewBox={lettering.viewBox} accessibilityLabel="Ona" accessibilityRole="image">
    {lettering.paths.map((d, index) => <Path key={index} d={d} fill="none" stroke={colors.ink}
      strokeWidth={lettering.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />)}
  </Svg>;
}
