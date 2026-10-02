import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type TextProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

export const colors = { background: '#FDFCFB', ink: '#141414', secondary: 'rgba(20,20,20,0.72)', border: 'rgba(20,20,20,0.62)', line: 'rgba(20,20,20,0.18)' };
const typography = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24, fontFamily: 'ManropeRegular' },
  label: { fontSize: 16, lineHeight: 24, fontFamily: 'ManropeMedium' },
  secondary: { fontSize: 14, lineHeight: 20, fontFamily: 'ManropeRegular', color: colors.secondary },
  title: { fontSize: 28, lineHeight: 36, letterSpacing: -0.55, fontFamily: 'ManropeMedium' },
  heading: { fontSize: 22, lineHeight: 30, letterSpacing: -0.25, fontFamily: 'ManropeMedium' },
  duration: { fontSize: 64, lineHeight: 76, letterSpacing: -1.6, fontFamily: 'ManropeRegular' },
  timer: { fontSize: 56, lineHeight: 68, letterSpacing: -1.4, fontFamily: 'ManropeRegular', fontVariant: ['tabular-nums'] },
  wordmark: { fontSize: 64, lineHeight: 76, letterSpacing: -2, fontFamily: 'ManropeMedium' },
});
export function Type({ role = 'body', style, ...props }: Omit<TextProps, 'role'> & { role?: keyof typeof typography }) {
  return <Text {...props} style={[{ color: colors.ink }, typography[role], style]} />;
}
export function Action({ children, onPress, quiet = false, disabled = false, label, textRole }: {
  children: string; onPress: () => void; quiet?: boolean; disabled?: boolean; label?: string; textRole?: keyof typeof typography;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? children} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, quiet ? styles.quiet : styles.outline,
      { opacity: disabled ? 0.4 : pressed ? 0.55 : 1 }]}>
    <Type role={textRole ?? (quiet ? 'secondary' : 'label')} style={{ textAlign: 'center' }}>{children}</Type>
  </Pressable>;
}
export function Screen({ children, style, scroll = true }: { children?: ReactNode; style?: ViewStyle; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const content: ViewStyle = { flexGrow: 1, paddingHorizontal: width <= 375 ? 20 : 24,
    paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24), ...style };
  return scroll ? <ScrollView style={styles.surface} contentContainerStyle={content} keyboardShouldPersistTaps="handled">{children}</ScrollView> :
    <View style={[styles.surface, content]}>{children}</View>;
}
export function Header({ title, back }: { title?: string; back?: () => void }) {
  return <View style={{ gap: 24 }}>
    {back && <View style={{ alignSelf: 'flex-start', marginLeft: -12 }}><Action quiet textRole="label" onPress={back}>Back</Action></View>}
    {title && <Type role="title">{title}</Type>}
  </View>;
}
export function Notice({ children }: { children: string | null }) {
  return children ? <Type role="secondary" accessibilityRole="alert" style={{ textAlign: 'center', marginVertical: 16 }}>{children}</Type> : null;
}
export function ChoiceRow({ label, value, onPress, divider = true }: { label: string; value: string; onPress?: () => void; divider?: boolean }) {
  const content = <><Type style={{ flex: 1 }}>{label}</Type><Type style={{ color: colors.secondary }}>{value}</Type></>;
  const rowStyle = [styles.row, !divider && { borderBottomWidth: 0 }];
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={rowStyle}>{content}</Pressable> : <View style={rowStyle}>{content}</View>;
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
});
