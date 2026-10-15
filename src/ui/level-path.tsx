import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { JOURNEY_CATEGORIES, JOURNEY_PRELUDE, type JourneyCategory, type JourneyLevel } from '@/domain/progression';
import { CategoryIcon } from './category-icon';
import { getCategoryPresentation, getLevelCategoryPresentation } from './category-presentation';
import { formatRipples } from './format-ripples';
import { colors, serifFont, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';

const HABIT_MILESTONE_LEVEL = 100;
const FUTURE_LINE = 'rgba(20,20,20,0.22)';
type LevelState = 'achieved' | 'current' | 'future';

const stateOf = (level: number, current: number, highest: number): LevelState =>
  level === current ? 'current' : level <= highest ? 'achieved' : 'future';
const stateWord = { achieved: 'Achieved', current: 'Current', future: 'Ahead' } as const;

function requirement(level: JourneyLevel) {
  const extra = [level.realDays > 1 ? `${level.realDays} practice days` : null,
    level.elapsedDays > 0 ? `a full ${level.elapsedDays === 365 ? 'year' : `${level.elapsedDays} days`} of practice` : null].filter(Boolean);
  return `${formatRipples(level.xpCenti)} Ripples${extra.length ? ` · ${extra.join(' and ')}` : ''}`;
}

/** One stepping stone. Achieved stones are filled, the current one is ringed, stones ahead are open. */
function Stone({ level, state, selected, onPress }: { level: JourneyLevel; state: LevelState; selected: boolean; onPress: () => void }) {
  const milestone = level.number === HABIT_MILESTONE_LEVEL;
  const size = milestone ? 18 : 14;
  return <QuietPressable accessibilityRole="button" accessibilityState={{ selected }}
    accessibilityLabel={`Level ${level.number}, ${stateWord[state]}, ${requirement(level)}${milestone ? ', completes the habit-building journey' : ''}`}
    onPress={onPress} hitSlop={8} style={styles.stoneHit}>
    <View style={styles.stoneTrack}>
      {state === 'current' && <View style={styles.currentHalo} />}
      <View style={[{ width: size, height: size, borderRadius: size / 2 },
        state === 'achieved' ? styles.achieved : state === 'current' ? styles.current : styles.future,
        milestone && state !== 'achieved' && styles.milestoneOpen]} />
    </View>
    <Type role="secondary" style={[styles.stoneNumber, selected && styles.stoneNumberSelected]}>{level.number}</Type>
  </QuietPressable>;
}

function Category({ category, levels, current, highest, selected, onSelect, last, onLayout }: {
  category: JourneyCategory; levels: readonly JourneyLevel[]; current: number; highest: number; selected: number;
  onSelect: (level: number) => void; last: boolean; onLayout: (y: number) => void;
}) {
  const presentation = getCategoryPresentation(category);
  const reached = category.firstLevel <= highest || (current >= category.firstLevel && current <= category.lastLevel);
  const complete = category.lastLevel <= highest;
  const chosen = levels.find((level) => level.number === selected);
  const status = current >= category.firstLevel && current <= category.lastLevel ? `Level ${current} of ${category.firstLevel}–${category.lastLevel}`
    : complete ? 'Complete' : `Levels ${category.firstLevel}–${category.lastLevel}`;
  return <View style={styles.category} onLayout={(event) => onLayout(event.nativeEvent.layout.y)}>
    <View style={styles.rail}>
      <View style={[styles.iconWell, !reached && styles.iconAhead]}><CategoryIcon category={category} size={26} /></View>
      {!last && <View style={[styles.thread, { backgroundColor: complete ? colors.ink : FUTURE_LINE }]} />}
    </View>
    <View style={[styles.body, !reached && styles.ahead]}>
      <Type role="heading" style={styles.name}>{presentation.name}</Type>
      <Type role="secondary" style={styles.theme}>{presentation.theme}</Type>
      <Type role="secondary" style={styles.status}>{status}</Type>
      <View style={styles.stones}>
        {levels.map((level, index) => {
          const state = stateOf(level.number, current, highest);
          const next = levels[index + 1];
          const joined = next !== undefined && stateOf(next.number, current, highest) !== 'future';
          return [
            <Stone key={level.number} level={level} state={state} selected={level.number === selected} onPress={() => onSelect(level.number)} />,
            next && <View key={`${level.number}-line`} style={[styles.connector, { backgroundColor: joined ? colors.ink : FUTURE_LINE }]} />,
          ];
        })}
      </View>
      {chosen && <View accessibilityLiveRegion="polite" style={styles.detail}>
        <Type role="label" style={{ fontSize: 14 }}>{chosen.number === HABIT_MILESTONE_LEVEL ? 'Level 100 · Habit Established'
          : `Level ${chosen.number} · ${getLevelCategoryPresentation(chosen).name}`}</Type>
        <Type role="secondary" style={styles.theme}>{`${stateWord[stateOf(chosen.number, current, highest)]} · ${requirement(chosen)}`}</Type>
        {chosen.number === HABIT_MILESTONE_LEVEL && <Type role="secondary" style={styles.theme}>Completes Ona’s habit-building journey.</Type>}
      </View>}
    </View>
  </View>;
}

/**
 * The whole journey as a path: each category is a stop on one thread, its five levels are stepping
 * stones. Tap a stone to read what it asks. Requirements always come from the domain level table.
 */
export function LevelPath({ levels, current, highest, onCategoryLayout }: {
  levels: readonly JourneyLevel[]; current: number; highest: number; onCategoryLayout: (id: string, y: number) => void;
}) {
  const [selected, setSelected] = useState(current);
  return <View>
    <View style={styles.category} onLayout={(event) => onCategoryLayout('prelude', event.nativeEvent.layout.y)}>
      <View style={styles.rail}>
        <View style={[styles.startStone, current === 0 ? styles.current : styles.achieved]} />
        <View style={[styles.thread, { backgroundColor: highest >= 1 ? colors.ink : FUTURE_LINE }]} />
      </View>
      <View accessible accessibilityLabel={`Level ${JOURNEY_PRELUDE.number}, starting point, ${current === 0 ? 'Current' : 'Achieved'}`} style={styles.body}>
        <Type role="label">Level 0 · Starting point</Type>
        <Type role="secondary" style={styles.theme}>Each quiet return adds to your journey.</Type>
      </View>
    </View>
    {JOURNEY_CATEGORIES.map((category, index) => <View key={category.id}>
      {category.firstLevel === 1 && <Phase title="Building your habit" note="Levels 1–100 · One return at a time." reached={highest >= 1} />}
      {category.firstLevel === HABIT_MILESTONE_LEVEL + 1 && <Phase title="Strengthen & sustain" note="Levels 101–125 · Nurturing the habit you’ve built."
        reached={highest >= HABIT_MILESTONE_LEVEL + 1} />}
      <Category category={category} levels={levels.filter((level) => level.category.id === category.id)} current={current} highest={highest}
        selected={selected} onSelect={setSelected} last={index === JOURNEY_CATEGORIES.length - 1}
        onLayout={(y) => onCategoryLayout(category.id, y)} />
    </View>)}
  </View>;
}

function Phase({ title, note, reached }: { title: string; note: string; reached: boolean }) {
  return <View style={styles.category}>
    <View style={styles.rail}><View style={[styles.thread, { backgroundColor: reached ? colors.ink : FUTURE_LINE }]} /></View>
    <View style={styles.phase}>
      <Type role="heading" style={styles.phaseTitle}>{title}</Type>
      <Type role="secondary">{note}</Type>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  phase: { flex: 1, gap: 6, paddingTop: 12, paddingBottom: 28 },
  phaseTitle: { fontFamily: serifFont, fontSize: 27, lineHeight: 34, letterSpacing: 0 },
  category: { flexDirection: 'row' },
  rail: { width: 44, alignItems: 'center', marginRight: 12 },
  iconWell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.background },
  iconAhead: { opacity: 0.55 },
  thread: { flex: 1, width: 1, minHeight: 16 },
  startStone: { width: 12, height: 12, borderRadius: 6, marginTop: 6, marginBottom: 6 },
  body: { flex: 1, paddingTop: 6, paddingBottom: 30, gap: 2 },
  ahead: { opacity: 0.62 },
  name: { fontFamily: serifFont, fontSize: 22, lineHeight: 28, letterSpacing: 0 },
  theme: { fontSize: 12, lineHeight: 18 },
  status: { fontSize: 11, lineHeight: 16, letterSpacing: 0.4, marginTop: 2 },
  stones: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, maxWidth: 300 },
  stoneHit: { alignItems: 'center', width: 28, gap: 6 },
  stoneTrack: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  connector: { flex: 1, height: 1, marginTop: 14 },
  achieved: { backgroundColor: colors.ink },
  current: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.ink },
  currentHalo: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(20,20,20,0.08)' },
  future: { backgroundColor: colors.background, borderWidth: 1, borderColor: FUTURE_LINE },
  milestoneOpen: { borderWidth: 1.5, borderColor: colors.ink },
  stoneNumber: { fontSize: 11, lineHeight: 14 },
  stoneNumberSelected: { color: colors.ink, fontFamily: 'ManropeMedium' },
  detail: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line, gap: 2 },
});
