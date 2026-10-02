import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import type { StoredMeditationSession } from '@/data';
import { Action, ChoiceRow, formatDuration, Header, Notice, Screen, styles, Type } from '@/ui/primitives';
export default function History() {
  const { history } = useOna();
  const [records, setRecords] = useState<readonly StoredMeditationSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    let disposed = false;
    void history().then((values) => { if (!disposed) { setRecords(values); setLoaded(true); setError(false); setHasMore(values.length === 50); } })
      .catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; };
  }, [attempt, history]);
  return <Screen><Header title="History" back={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />
    <View style={{ marginTop: 32 }}>{!loaded && !error && <Type role="secondary">Opening your history…</Type>}
      {loaded && !records.length && <Type role="secondary">No practice yet</Type>}
      {records.map(({ session }) => <View key={session.id} style={{ marginBottom: 24 }}><Type role="secondary">{session.localDate}</Type>
        <ChoiceRow label={formatDuration(session.activeDurationSeconds)} value={session.status === 'completed' ? 'Complete' : 'Ended early'} /></View>)}
    </View><Notice>{error ? 'History could not be loaded.' : null}</Notice>
    {error && <Action quiet onPress={() => setAttempt((value) => value + 1)}>Try again</Action>}
    {hasMore && <View style={styles.footer}><Action quiet onPress={() => { setHasMore(false);
      void history(records.length).then((values) => { setRecords([...records, ...values]); setHasMore(values.length === 50); }).catch(() => { setError(true); setHasMore(true); });
    }}>More</Action></View>}
  </Screen>;
}
