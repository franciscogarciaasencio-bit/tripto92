import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useOna } from '@/application/ona-provider';
import type { PracticeDetails } from '@/data';
import { CoastalTexture, coastalInk, coastalQuiet, coastalSerif } from './coastal-scene';
import { HomeNavigation } from './home-navigation';
import { HomeIcon } from './home-icons';
import { formatRipples } from './format-ripples';
import { practiceClockLabel, practiceDateLabel } from './practice-history';
import { Action, ChoiceRow, formatDuration, formatTime, Header, Notice, Screen, Type } from './primitives';

export function PracticeDetailScreen() {
  const { id: parameter } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof parameter === 'string' && parameter.trim() ? parameter : null;
  const { practiceDetails, practiceRevision } = useOna();
  const { width, height } = useWindowDimensions();
  const [loaded, setLoaded] = useState<{ id: string | null; revision: number; attempt: number; value: PracticeDetails | null } | null>(null);
  const [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let disposed = false;
    setLoaded(null); setError(false);
    if (!id) { setLoaded({ id, revision: practiceRevision, attempt, value: null }); return; }
    void practiceDetails(id).then(value => {
      if (!disposed) setLoaded({ id, revision: practiceRevision, attempt, value });
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; };
  }, [id, practiceDetails, practiceRevision, attempt]));
  const current = loaded?.id === id && loaded?.revision === practiceRevision && loaded?.attempt === attempt;
  const details = current ? loaded?.value : null;
  const finishedAt = details ? practiceClockLabel(details.session.endedAt, details.session.timeZone) : null;
  const back = () => { if (router.canGoBack()) router.back(); else router.replace({ pathname: '/practice', params: { view: 'calendar' } }); };
  return <View style={{ flex: 1 }}>
    <CoastalTexture width={width} height={height} />
    <Screen style={{ backgroundColor: 'transparent', paddingBottom: 24 }}>
      <Header back={back} />
      {details ? <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', paddingTop: 36 }}>
        <Text style={{ fontFamily: 'ManropeMedium', color: coastalQuiet, fontSize: 11, lineHeight: 18, letterSpacing: 2.5, textAlign: 'center' }}>YOUR PRACTICE</Text>
        <Text accessibilityRole="header" style={{ fontFamily: coastalSerif, color: coastalInk, fontSize: 40, lineHeight: 48, textAlign: 'center', marginTop: 12 }}>A quiet moment.</Text>
        <Type role="secondary" style={{ textAlign: 'center', marginTop: 12 }}>
          {practiceDateLabel(details.session.localDate, { month: 'long', day: 'numeric', year: 'numeric' })}
        </Type>
        <Text accessibilityLabel={`Active meditation duration: ${formatDuration(details.session.activeDurationSeconds)}`}
          style={{ fontFamily: coastalSerif, color: coastalInk, fontSize: 64, lineHeight: 80, fontVariant: ['tabular-nums'], textAlign: 'center', marginTop: 36 }}>
          {formatTime(details.session.activeDurationSeconds).padStart(5, '0')}
        </Text>
        <Type role="secondary" style={{ textAlign: 'center' }}>Time for yourself</Type>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 32 }}>
          <HomeIcon name="wave" size={30} color={coastalInk} />
          <Text accessibilityLabel={`${formatRipples(details.awardedXpCenti)} Ripples earned in this practice`}
            style={{ fontFamily: coastalSerif, fontSize: 28, lineHeight: 38, color: coastalInk }}>{formatRipples(details.awardedXpCenti)} Ripples</Text>
        </View>
        <Type role="secondary" style={{ textAlign: 'center', marginTop: 8 }}>A saved part of your journey.</Type>
        <View style={{ marginTop: 32 }}>
          <ChoiceRow label="Practice" value={details.session.status === 'completed' ? 'Complete' : 'Ended early'} />
          {details.session.pausedDurationSeconds > 0 && <ChoiceRow label="Paused time" value={formatTime(details.session.pausedDurationSeconds).padStart(5, '0')} />}
          {finishedAt && <ChoiceRow label="Local finish time" value={finishedAt} />}
        </View>
        <Type role="secondary" style={{ textAlign: 'center', marginTop: 24 }}>One quiet return at a time.</Type>
      </View> : <View style={{ paddingVertical: 48, gap: 16 }}>
        <Type role="heading" style={{ textAlign: 'center' }}>{error ? 'Practice could not be opened' : current ? 'This practice is no longer here' : 'Opening your practice…'}</Type>
        {error ? <><Notice>Your saved practice is unchanged.</Notice><Action quiet onPress={() => setAttempt(value => value + 1)}>Try again</Action></>
          : current && <Type role="secondary" style={{ textAlign: 'center' }}>Return to your calendar to see your saved moments.</Type>}
      </View>}
    </Screen>
    <HomeNavigation active="journey" />
  </View>;
}
