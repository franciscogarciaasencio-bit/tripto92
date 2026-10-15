import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, SectionList, View } from 'react-native';
import { useOna } from '@/application/ona-provider';
import type { StoredMeditationSession } from '@/data';
import { HomeNavigation } from './home-navigation';
import { Action, colors, formatDuration, Header, Notice, Screen, Type } from './primitives';
import { PracticeRow } from './practice-row';
import { appendHistoryPage, groupPracticeHistory, practiceDateLabel } from './practice-history';

interface HistoryView {
  records: readonly StoredMeditationSession[];
  revision: number;
  completedPractices: number;
  offset: number;
  loaded: boolean;
  hasMore: boolean;
  busy: 'first' | 'refresh' | 'more' | null;
  error: 'first' | 'more' | null;
}

export function HistoryScreen() {
  const { history, practiceRevision, completedPractices } = useOna();
  const request = useRef(0), loading = useRef(false), openingDetails = useRef(false);
  const cachedFor = useRef<{ revision: number; completedPractices: number } | null>(null);
  const [view, setView] = useState<HistoryView>({ records: [], revision: practiceRevision, completedPractices,
    offset: 0, loaded: false, hasMore: false, busy: 'first', error: null });
  const current = view.revision === practiceRevision && view.completedPractices === completedPractices;
  const sections = useMemo(() => groupPracticeHistory(current ? view.records : []), [current, view.records]);

  const refresh = useCallback(async () => {
    const token = ++request.current;
    loading.current = true;
    cachedFor.current = null;
    setView(previous => {
      const retained = previous.revision === practiceRevision && previous.completedPractices === completedPractices;
      return { ...previous, revision: practiceRevision, completedPractices, records: retained ? previous.records : [],
        loaded: retained && previous.loaded, busy: retained && previous.loaded ? 'refresh' : 'first', error: null };
    });
    try {
      const records = await history();
      if (request.current !== token) return;
      cachedFor.current = { revision: practiceRevision, completedPractices };
      setView({ records, revision: practiceRevision, completedPractices, offset: records.length,
        loaded: true, hasMore: records.length === 50, busy: null, error: null });
    } catch {
      if (request.current === token) setView(previous => ({ ...previous, busy: null, error: 'first' }));
    } finally {
      if (request.current === token) loading.current = false;
    }
  }, [history, practiceRevision, completedPractices]);

  useFocusEffect(useCallback(() => {
    openingDetails.current = false;
    // Returning from details keeps loaded pages and scroll position. This app owns writes;
    // a new completion/reset invalidates the cache, and pull-to-refresh deliberately reloads.
    if (cachedFor.current?.revision === practiceRevision && cachedFor.current.completedPractices === completedPractices)
      setView(previous => previous.busy === 'more' ? { ...previous, busy: null } : previous);
    else void refresh();
    // Discard late reads after leaving, reset or a new completion. Never restore deleted rows.
    return () => { ++request.current; loading.current = false; };
  }, [refresh, practiceRevision, completedPractices]));

  async function loadMore() {
    if (loading.current || !current || !view.hasMore) return;
    const token = ++request.current, offset = view.offset;
    loading.current = true;
    setView(previous => ({ ...previous, busy: 'more', error: null }));
    try {
      const page = await history(offset);
      if (request.current !== token) return;
      setView(previous => ({ ...previous, records: appendHistoryPage(previous.records, page), offset: offset + page.length,
        hasMore: page.length === 50, busy: null, error: null }));
    } catch {
      if (request.current === token) setView(previous => ({ ...previous, busy: null, error: 'more' }));
    } finally {
      if (request.current === token) loading.current = false;
    }
  }

  return <View style={{ flex: 1 }}><Screen scroll={false} style={{ paddingBottom: 0 }}>
    <Header title="History" back={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />
    <SectionList style={{ flex: 1, marginTop: 8 }} sections={sections} keyExtractor={({ session }) => session.id}
      stickySectionHeadersEnabled contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={current && view.busy === 'refresh'} onRefresh={() => { void refresh(); }}
        tintColor={colors.ink} colors={[colors.ink]} progressBackgroundColor={colors.background} />}
      renderSectionHeader={({ section }) => <View style={{ gap: 2, paddingTop: 20, paddingBottom: 6, backgroundColor: colors.background }}>
        <Type role="heading" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 30 }}>
          {practiceDateLabel(section.key, { month: 'long', day: 'numeric', year: 'numeric' })}
        </Type>
        <Type role="secondary">{`${section.data.length} ${section.data.length === 1 ? 'practice' : 'practices'}${view.hasMore ? ' shown' : ''} · ${formatDuration(section.activeSeconds)}`}</Type>
      </View>}
      renderItem={({ item: { session } }) => <PracticeRow session={session} onPress={() => {
        if (openingDetails.current) return;
        openingDetails.current = true;
        router.push({ pathname: '/practice-detail', params: { id: session.id } });
      }} />}
      ListEmptyComponent={<View style={{ paddingVertical: 24, gap: 12 }}>
        {(!current || view.busy === 'first') ? <Type role="secondary">Opening your history…</Type>
          : view.loaded && !view.error ? <>
            <Type role="heading">No practice yet</Type>
            <Type role="secondary">Your quiet moments will find a home here.</Type>
            <Action quiet onPress={() => router.dismissTo('/')}>Return Home</Action>
          </> : null}
      </View>}
      ListFooterComponent={<View style={{ gap: 8, paddingVertical: 16, alignItems: 'center' }}>
        <Notice>{current && view.error ? 'History could not be loaded. Your saved practice is unchanged.' : null}</Notice>
        {current && view.error === 'first' && <Action quiet disabled={view.busy !== null} onPress={() => { void refresh(); }}>Try again</Action>}
        {current && view.hasMore && view.error !== 'first' && <Action quiet disabled={view.busy !== null} onPress={() => { void loadMore(); }}>
          {view.busy === 'more' ? 'Opening more…' : view.error === 'more' ? 'Try loading more' : 'More'}
        </Action>}
      </View>} />
  </Screen><HomeNavigation active="journey" /></View>;
}
