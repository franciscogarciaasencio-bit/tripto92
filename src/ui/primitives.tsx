import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type TextProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import theme from './theme.json';
import { QuietPressable } from './quiet-pressable';
import { HomeIcon } from './home-icons';

export const colors = { ...theme, secondary: 'rgba(20,20,20,0.72)', border: 'rgba(20,20,20,0.62)', line: 'rgba(20,20,20,0.18)' };
/**
 * Newsreader (SIL OFL, bundled in assets/fonts) is Ona's editorial serif on every platform, so the
 * wordmark, level names and timer look the same on iOS, Android and web. Manrope carries the text.
 */
export const serifFont = 'NewsreaderRegular';
const typography = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24, fontFamily: 'ManropeRegular' },
  label: { fontSize: 16, lineHeight: 24, fontFamily: 'ManropeMedium' },
  secondary: { fontSize: 14, lineHeight: 20, fontFamily: 'ManropeRegular', color: colors.secondary },
  title: { fontSize: 34, lineHeight: 42, letterSpacing: -0.5, fontFamily: serifFont },
  heading: { fontSize: 24, lineHeight: 32, letterSpacing: -0.2, fontFamily: serifFont },
  duration: { fontSize: 64, lineHeight: 76, letterSpacing: -1.6, fontFamily: 'ManropeRegular' },
  timer: { fontSize: 56, lineHeight: 68, letterSpacing: -1.4, fontFamily: 'ManropeRegular', fontVariant: ['tabular-nums'] },
  wordmark: { fontSize: 64, lineHeight: 76, letterSpacing: -2, fontFamily: 'ManropeMedium' },
});
export function Type({ role = 'body', style, ...props }: Omit<TextProps, 'role'> & { role?: keyof typeof typography }) {
  // Titles and headings are announced as headers so screen-reader users can jump between sections.
  const header = role === 'title' || role === 'heading' ? { accessibilityRole: 'header' as const } : null;
  return <Text {...header} {...props} style={[{ color: colors.ink }, typography[role], style]} />;
}
export function Action({ children, onPress, quiet = false, disabled = false, label, textRole }: {
  children: string; onPress: () => void; quiet?: boolean; disabled?: boolean; label?: string; textRole?: keyof typeof typography;
}) {
  return <QuietPressable accessibilityRole="button" accessibilityLabel={label ?? children} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[styles.action, quiet ? styles.quiet : styles.outline]}>
    <Type role={textRole ?? (quiet ? 'secondary' : 'label')} style={{ textAlign: 'center' }}>{children}</Type>
  </QuietPressable>;
}
export function Screen({ children, style, scroll = true }: { children?: ReactNode; style?: ViewStyle; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const content: ViewStyle = { flexGrow: 1, paddingHorizontal: width <= 375 ? 20 : 24,
    paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24), ...style };
  return scroll ? <ScrollView style={styles.surface} contentContainerStyle={content} keyboardShouldPersistTaps="handled">{children}</ScrollView> :
    <View style={[styles.surface, content]}>{children}</View>;
}
/** A screen title with an optional quiet back arrow (48 pt target, the same arrow the forest uses). */
export function Header({ title, back }: { title?: string; back?: () => void }) {
  return <View style={{ paddingTop: back ? 4 : 16, gap: 8 }}>
    {back && <QuietPressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={4} style={styles.back}>
      <View style={{ transform: [{ rotate: '180deg' }] }}><HomeIcon name="arrow" size={22} color={colors.secondary} /></View>
    </QuietPressable>}
    {title && <Type role="title">{title}</Type>}
  </View>;
}
export function Notice({ children }: { children: string | null }) {
  return children ? <Type role="secondary" accessibilityRole="alert" style={{ textAlign: 'center', marginVertical: 16 }}>{children}</Type> : null;
}
export function ChoiceRow({ label, value, onPress, divider = true }: { label: string; value: string; onPress?: () => void; divider?: boolean }) {
  const content = <><Type style={{ flex: 1 }}>{label}</Type><Type style={{ color: colors.secondary }}>{value}</Type></>;
  const rowStyle = [styles.row, !divider && { borderBottomWidth: 0 }];
  return onPress ? <QuietPressable accessibilityRole="button" onPress={onPress} style={rowStyle}>{content}</QuietPressable> : <View style={rowStyle}>{content}</View>;
}
export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function formatDuration(seconds: number) {
  return seconds % 60 === 0 ? `${seconds / 60} ${seconds === 60 ? 'minute' : 'minutes'}` : `${formatTime(seconds)} active`;
}
export const styles = StyleSheet.create({
  surface: { flex: 1, backgroundColor: colors.background },
  action: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  quiet: { borderWidth: 0 },
  outline: { minHeight: 60, minWidth: 184, borderRadius: 18, borderWidth: 1.25, borderColor: colors.border },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  row: { minHeight: 64, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  footer: { alignItems: 'center', gap: 8, paddingTop: 24 },
  back: { width: 48, height: 48, marginLeft: -13, alignItems: 'center', justifyContent: 'center' },
});
