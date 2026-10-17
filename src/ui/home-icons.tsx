import Svg, { Circle, Path } from 'react-native-svg';

export type HomeIconName = 'home' | 'journey' | 'history' | 'settings' | 'speaker' | 'consistency' | 'arrow' | 'wave' | 'info' | 'pause' | 'play' | 'friends' | 'plus';

/** Monochrome drawings matched to Design 3, without platform-dependent symbol substitutions. */
export function HomeIcon({ name, size = 24, color = '#20221F', selected = false }: {
  name: HomeIconName; size?: number; color?: string; selected?: boolean;
}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    {name === 'home' && <Path d="M3.5 10.5 12 3l8.5 7.5V22h-6v-7h-5v7h-6Z" fill={selected ? color : 'none'} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />}
    {name === 'journey' && <><Circle cx={12} cy={4.4} r={2.25} fill="none" stroke={color} strokeWidth={1.3} />
      <Path d="M9.5 9.1c.7-1.5 4.3-1.5 5 0M10 9.3l-.6 5.3m4.6-5.3.6 5.3M9.4 9.5 7 14.1l-2.6 1.1m10.2-5.7 2.4 4.6 2.6 1.1M7.2 15.3c-2.4-.9-4.8.5-4.8 2.4 0 1.5 2.4 2.4 4.8 2.4h9.6c2.4 0 4.8-.9 4.8-2.4 0-1.9-2.4-3.3-4.8-2.4M7.2 15.3l7 4.8m2.6-4.8-7 4.8" fill="none" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" /></>}
    {name === 'history' && <><Circle cx={12} cy={12} r={9.5} fill="none" stroke={color} strokeWidth={1.3} /><Path d="M12 5.5v7l4.5 2" fill="none" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" /></>}
    {name === 'settings' && <><Path d="m9.5 2-.7 2.7-2.5 1-2.4-1.2-2 3.5 2.1 1.8-.3 2.8-2.2 1.5 1.8 3.7 2.7-.7 2.2 1.5.4 2.8h4l.7-2.7 2.5-1 2.4 1.2 2-3.5-2.1-1.8.3-2.8 2.2-1.5-1.8-3.7-2.7.7-2.2-1.5-.4-2.8Z" fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" /><Circle cx={11.8} cy={11.6} r={3.2} fill="none" stroke={color} strokeWidth={1.4} /></>}
    {name === 'speaker' && <><Path d="M3 9h4l5-4v14l-5-4H3Z" fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
      <Path d={selected ? 'M16 8c2 2 2 6 0 8M19 5c4 4 4 10 0 14' : 'm16 9 6 6m0-6-6 6'} fill="none" stroke={color} strokeWidth={1.1} strokeLinecap="round" /></>}
    {name === 'consistency' && <><Circle cx={12} cy={12} r={9.5} fill="none" stroke={color} strokeWidth={1.35} /><Path d="m12 12 2.4-2.7" stroke={color} strokeWidth={1.2} strokeLinecap="round" /><Circle cx={12} cy={12} r={1} fill={color} /></>}
    {name === 'arrow' && <Path d="M2 12h19m-7-6.2 7 6.2-7 6.2" fill="none" stroke={color} strokeWidth={1.45} strokeLinecap="round" strokeLinejoin="round" />}
    {name === 'wave' && <><Path d="M1.5 12c4.4 0 4.8-6.8 9.6-6.8S16 11.6 22.5 8.4M4 17.5c4.4 0 4.8-6.8 9.6-6.8s4.7 5.4 8.9 2.2" fill="none" stroke={color} strokeWidth={selected ? 1.55 : 1.2} strokeLinecap="round" /></>}
    {name === 'info' && <><Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={1.2} /><Path d="M12 10.5v6" stroke={color} strokeWidth={1.2} strokeLinecap="round" /><Circle cx={12} cy={7} r={.8} fill={color} /></>}
    {name === 'pause' && <Path d="M8 4v16M16 4v16" stroke={color} strokeWidth={3.5} strokeLinecap="round" />}
    {name === 'play' && <Path d="m8 4 12 8-12 8Z" fill={color} stroke={color} strokeLinejoin="round" />}
    {/* Two people side by side, the nearer one whole and the other just behind; same line weight as the wave. */}
    {name === 'friends' && <><Circle cx={9.4} cy={8.2} r={3.4} fill="none" stroke={color} strokeWidth={1.2} />
      <Path d="M3 20.2c.5-3.7 3.1-6.1 6.4-6.1s5.9 2.4 6.4 6.1" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M15.2 4.6a2.9 2.9 0 1 1 1.4 5.6M17.4 13.4c2.3.5 3.6 2.5 4 5.2" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" /></>}
    {name === 'plus' && <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={1.3} strokeLinecap="round" />}
  </Svg>;
}
