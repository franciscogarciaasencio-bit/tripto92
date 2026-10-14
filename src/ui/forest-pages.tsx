import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Gesture } from 'react-native-gesture-handler';
import { useOna } from '@/application/ona-provider';
import { useOnaAudio } from '@/application/audio-provider';
import { HomeScreen } from './home-screen';
import { ForestScreen } from './forest-screen';
import { ForestSwipe } from './forest-swipe';
import { useForeground } from './use-foreground';

// Presentation-only scroll continuity, scoped to this app instance; never practice data.
const HomeScroll = createContext<{ current: number } | null>(null);
export function ForestNavigationProvider({ children }: { children: ReactNode }) {
  const offset = useRef(0);
  return <HomeScroll.Provider value={offset}>{children}</HomeScroll.Provider>;
}
/** Same surfaces for live/preview pages; previews have no navigation/save side effects. */
export function ForestPages({ page }: { page: 'home' | 'forest' }) {
  const app = useOna(), audio = useOnaAudio(), foreground = useForeground();
  const scrollOffsetRef = useContext(HomeScroll), swipeRef = useRef<{ navigate: () => void }>(null);
  const go = useCallback(() => swipeRef.current?.navigate(), []);
  const [focused, setFocused] = useState(false);
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const navigate = useCallback(() => {
    if (page === 'home') router.push('/forest');
    else router.dismissTo('/');
  }, [page]);
  const enabled = focused && foreground && !app.busy && !app.draft && !app.completion && !audio.starting;
  const preview = (moving: boolean) => page === 'home' ? <ForestScreen goHome={() => {}} />
    : <HomeScreen openForest={() => {}} scrollOffsetRef={scrollOffsetRef} animateWave={focused && moving} />;
  return <ForestSwipe direction={page === 'home' ? 'left' : 'right'} enabled={enabled}
    ref={swipeRef} scrollGesture={scrollGesture} onNavigate={navigate} preview={preview}>
    {page === 'home'
      ? <HomeScreen openForest={go} scrollGesture={scrollGesture} scrollOffsetRef={scrollOffsetRef} rememberScroll animateWave={focused} />
      : <ForestScreen goHome={go} />}
  </ForestSwipe>;
}
