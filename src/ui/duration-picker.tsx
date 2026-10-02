import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Action, colors, Type } from './primitives';
export function DurationPicker({ seconds, onChange }: { seconds: number; onChange: (value: number) => void }) {
  const [editing, setEditing] = useState(false);
  const minutes = Math.round(seconds / 60);
  return <View style={{ alignItems: 'center', gap: 12 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Duration ${minutes} minutes. Edit duration`} onPress={() => setEditing(!editing)} style={{ alignItems: 'center', minWidth: 140 }}>
      <Type role="duration">{minutes}</Type><Type style={{ color: colors.secondary }}>minutes</Type>
    </Pressable>
    <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
      {[5, 10, 20, 30, 60].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} minutes`}
        accessibilityState={{ selected: value === minutes }} onPress={() => onChange(value * 60)}
        style={{ minWidth: 52, minHeight: 48, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center', borderWidth: value === minutes ? 1.25 : 0, borderRadius: 18, borderColor: colors.border }}>
        <Type role="label" style={{ color: value === minutes ? colors.ink : colors.secondary }}>{value}</Type>
      </Pressable>)}
    </View>
    {editing && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
      <Action quiet label="One minute less" disabled={minutes <= 1} onPress={() => onChange(Math.max(1, minutes - 1) * 60)}>−</Action>
      <TextInput accessibilityLabel="Duration in minutes, 1 to 180" keyboardType="number-pad" selectTextOnFocus value={String(minutes)}
        onChangeText={(value) => { const next = Number(value); if (/^\d+$/.test(value) && next >= 1 && next <= 180) onChange(next * 60); }}
        style={{ fontFamily: 'ManropeRegular', color: colors.ink, fontSize: 22, minWidth: 64, minHeight: 48, textAlign: 'center', borderBottomWidth: 1, borderColor: colors.border }} />
      <Action quiet label="One minute more" disabled={minutes >= 180} onPress={() => onChange(Math.min(180, minutes + 1) * 60)}>+</Action>
    </View>}
  </View>;
}
