import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { looksLikeEmail, useFriends, type Friend, type FriendActionResult, type FriendRequest } from '@/application/friends-provider';
import { currentContext, useOna } from '@/application/ona-provider';
import { sharedWeeksInARow, stageDiscovered, stageOfLevel } from '@/domain/progression';
import { CategoryIcon } from './category-icon';
import { PaperBackdrop } from './coastal-scene';
import { HomeIcon } from './home-icons';
import { Action, colors, Header, Notice, Screen, serifFont, Type } from './primitives';
import { QuietPressable } from './quiet-pressable';
import { useReducedMotion } from './reduced-motion';
import { UI_MOTION } from './motion';

const LINE = 'rgba(20,20,20,0.16)';
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Level and weeks in a row, as one quiet line; nothing else about a friend's practice is shared. */
export function friendDetail(friend: Pick<Friend, 'level' | 'streak'>, today: string) {
  if (friend.level === null) return 'Nothing shared yet';
  const weeks = sharedWeeksInARow(friend.streak, today);
  return weeks > 0 ? `Level ${friend.level} · ${weeks} ${weeks === 1 ? 'week' : 'weeks'} in a row` : `Level ${friend.level}`;
}

/** A friend's stage in a soft halo. A stage you have not reached yourself stays an empty ring. */
function StageMark({ level, ownHighest }: { level: number | null; ownHighest: number }) {
  const known = level !== null && stageDiscovered(level, ownHighest);
  return <View style={styles.mark}>
    {known ? <CategoryIcon category={stageOfLevel(level)} level={level} size={34} />
      : <Svg width={20} height={20} viewBox="0 0 20 20" accessible={false}>
        <Circle cx={10} cy={10} r={8.5} fill="none" stroke="rgba(20,20,20,0.3)" strokeWidth={1} strokeDasharray="1.6 3.2" strokeLinecap="round" />
      </Svg>}
  </View>;
}

function FriendRow({ friend, name, detail, ownHighest, open, onToggle, onRemove }: {
  friend: Friend; name: string; detail: string; ownHighest: number; open: boolean; onToggle: () => void; onRemove: () => void;
}) {
  const reduced = useReducedMotion();
  const hidden = friend.level !== null && !stageDiscovered(friend.level, ownHighest);
  return <View style={styles.rowFrame}>
    <QuietPressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle}
      accessibilityLabel={`${name}. ${detail}${hidden ? '. A stage you have not reached yet' : ''}`} style={styles.friend}>
      <StageMark level={friend.level} ownHighest={ownHighest} />
      <View style={{ flex: 1, gap: 1 }}>
        <Type numberOfLines={1} style={styles.name}>{name}</Type>
        <Type role="secondary">{detail}</Type>
      </View>
    </QuietPressable>
    {open && <Animated.View entering={reduced ? undefined : FadeIn.duration(UI_MOTION.reveal)}
      exiting={reduced ? undefined : FadeOut.duration(UI_MOTION.reveal)} style={styles.removeLine}>
      <QuietPressable accessibilityRole="button" onPress={onRemove} style={styles.smallAction}>
        <Type role="secondary">{`Remove ${name}`}</Type>
      </QuietPressable>
    </Animated.View>}
  </View>;
}

/** A compact outlined button for answers inside a row (the full-width Action is for screens). */
function Pill({ children, onPress, disabled = false }: { children: string; onPress: () => void; disabled?: boolean }) {
  return <QuietPressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={styles.pill}>
    <Type role="label" style={{ fontSize: 15 }}>{children}</Type>
  </QuietPressable>;
}

function RequestCard({ request, busy, onAccept, onLater }: { request: FriendRequest; busy: boolean; onAccept: () => void; onLater: () => void }) {
  return <View style={styles.request}>
    <Type role="secondary" style={styles.kicker}>ADDED YOU</Type>
    <Type numberOfLines={1} style={styles.name}>{request.name}</Type>
    <Type role="secondary" numberOfLines={1}>{request.email}</Type>
    <View style={styles.requestActions}>
      <Pill disabled={busy} onPress={onAccept}>Add back</Pill>
      <QuietPressable accessibilityRole="button" disabled={busy} onPress={onLater} style={styles.smallAction}>
        <Type role="secondary">Not now</Type>
      </QuietPressable>
    </View>
  </View>;
}

const ADDED: Record<FriendActionResult, string> = {
  invited: 'Added. When they add you in Ona too, you’ll see each other here. Ona sends no email, so let them know.',
  friends: 'You’re friends now.',
  self: 'That’s your own address.',
  offline: 'You seem to be offline. Please try again when you’re connected.',
  failed: 'That didn’t work. Please try again.',
};

/**
 * Friends (owner, 2026-10-17): add someone by email; once you have added each other, each sees the
 * other's stage, level and weeks in a row. Nothing else. Requests wait at the top, invitations at the end.
 */
export function FriendsScreen() {
  const app = useOna(), friends = useFriends(), reduced = useReducedMotion();
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [signInMessage, setSignInMessage] = useState<string | null>(null);
  const today = currentContext().localDate;
  const ownHighest = Math.max(app.habit?.highestLevel ?? 0, app.journey?.level.number ?? 0);
  const { refresh } = friends;
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const list = friends.list;
  const empty = !!list && !list.friends.length && !list.requests.length && !list.invited.length;
  const showForm = friends.signedIn && !!list && (adding || empty);
  // First names, unless two friends share one.
  const names = useMemo(() => {
    const counts = new Map<string, number>();
    for (const friend of list?.friends ?? []) counts.set(firstName(friend.name), (counts.get(firstName(friend.name)) ?? 0) + 1);
    return new Map((list?.friends ?? []).map((friend) => [friend.id, (counts.get(firstName(friend.name)) ?? 0) > 1 ? friend.name : firstName(friend.name)]));
  }, [list]);

  /** One action at a time; connection problems are said plainly and the list reloads either way. */
  const run = (work: () => Promise<FriendActionResult | void>, success?: (result: FriendActionResult) => void) => {
    if (working) return;
    setWorking(true); setMessage(null);
    void work().then((result) => {
      if (result === 'offline' || result === 'failed') setMessage(ADDED[result]);
      else if (result) success?.(result);
    }).finally(() => setWorking(false));
  };
  const submit = () => {
    const address = email.trim();
    if (!looksLikeEmail(address)) { setMessage('Please enter an email address.'); return; }
    run(() => friends.add(address), (result) => {
      setMessage(ADDED[result]);
      if (result !== 'self') setEmail('');
    });
  };

  let body: React.ReactNode;
  if (!friends.available) {
    body = <Type role="secondary" style={{ marginTop: 24 }}>Friends are not available in this version of Ona.</Type>;
  } else if (!friends.signedIn) {
    const blocked = app.busy || !!app.draft || !!app.completion;
    body = <View style={{ gap: 14, marginTop: 28 }}>
      <Type role="heading">Practise alongside friends</Type>
      <Type role="secondary">Sign in with Google to add friends by email. Once you have added each other, you’ll see each other’s level and weeks in a row. Nothing else is shared.</Type>
      <View style={{ marginTop: 12 }}>
        <Action disabled={blocked} onPress={() => {
          setSignInMessage(null);
          void app.signIn().then((signedIn) => { if (!signedIn && !app.error) setSignInMessage('Sign-in was cancelled.'); });
        }}>{app.busy ? 'Opening…' : 'Continue with Google'}</Action>
      </View>
      <Type role="secondary" style={{ textAlign: 'center' }}>Ona works fully without an account.</Type>
      <Notice>{app.error ? 'Something went wrong. Please try again.' : signInMessage}</Notice>
    </View>;
  } else if (!list) {
    body = <View style={{ marginTop: 28, gap: 8 }}>
      <Type role="secondary">{friends.phase === 'offline' ? 'Your friends appear here when you’re online.'
        : friends.phase === 'signed_out' ? 'Sign in again in Settings, Account, to see your friends.'
          : friends.phase === 'failed' ? 'Your friends could not be opened.' : 'Opening your friends…'}</Type>
      {(friends.phase === 'offline' || friends.phase === 'failed') && <Action quiet onPress={() => { void refresh(); }}>Try again</Action>}
    </View>;
  } else {
    body = <>
      {showForm && <Animated.View entering={reduced || empty ? undefined : FadeIn.duration(UI_MOTION.reveal)} style={styles.form}>
        {empty && <Type role="secondary" style={{ marginBottom: 18 }}>Add a friend by their email. Once you have added each other, you’ll see each other’s level and weeks in a row.</Type>}
        <View style={styles.field}>
          <TextInput value={email} onChangeText={(value) => { setEmail(value); setMessage(null); }}
            placeholder="Their email address" placeholderTextColor="rgba(20,20,20,0.42)" accessibilityLabel="Friend’s email address"
            keyboardType="email-address" inputMode="email" autoCapitalize="none" autoCorrect={false} autoComplete="email"
            textContentType="emailAddress" returnKeyType="done" onSubmitEditing={submit} autoFocus={adding && !empty}
            editable={!working} style={styles.input} />
          <QuietPressable accessibilityRole="button" accessibilityLabel="Add friend" accessibilityState={{ disabled: working || !email.trim() }}
            disabled={working || !email.trim()} onPress={submit} style={styles.addButton}>
            <Type role="label">{working ? 'Adding…' : 'Add'}</Type>
          </QuietPressable>
        </View>
        <Type role="secondary" accessibilityLiveRegion="polite" style={styles.formNote}>{message ?? ' '}</Type>
      </Animated.View>}
      {!showForm && <Notice>{message}</Notice>}
      {list.requests.map((request) => <RequestCard key={request.id} request={request} busy={working}
        onAccept={() => run(() => friends.add(request.email))}
        onLater={() => run(() => friends.remove(request.id))} />)}
      {list.friends.length > 0 && <View style={styles.list}>
        {list.friends.map((friend) => <FriendRow key={friend.id} friend={friend} name={names.get(friend.id) ?? friend.name}
          detail={friendDetail(friend, today)} ownHighest={ownHighest} open={open === friend.id}
          onToggle={() => setOpen(open === friend.id ? null : friend.id)}
          onRemove={() => { setOpen(null); run(() => friends.remove(friend.id)); }} />)}
      </View>}
      {list.invited.length > 0 && <View style={styles.invited}>
        {list.invited.map((address) => <View key={address} style={styles.invitedRow}>
          <Type role="secondary" numberOfLines={1} style={{ flex: 1 }}>{`Waiting for ${address}`}</Type>
          <QuietPressable accessibilityRole="button" accessibilityLabel={`Withdraw the invitation to ${address}`} disabled={working}
            onPress={() => run(() => friends.cancel(address))} style={styles.smallAction}>
            <Type role="secondary">Withdraw</Type>
          </QuietPressable>
        </View>)}
      </View>}
      {friends.phase === 'offline' && <Type role="secondary" style={{ textAlign: 'center', marginTop: 16 }}>Offline. Showing your friends as they were.</Type>}
      <Type role="secondary" style={styles.footnote}>
        {`Friends see only your level and weeks in a row.${app.account?.email ? ` They can add you with ${app.account.email}.` : ''}`}
      </Type>
    </>;
  }

  const canAdd = friends.signedIn && !!list && !empty;
  return <PaperBackdrop><Screen scroll={false} style={{ paddingBottom: 0, backgroundColor: 'transparent' }}>
    <Header back={() => router.back()} />
    <View style={styles.titleRow}>
      <Type role="title">Friends</Type>
      {canAdd && <QuietPressable accessibilityRole="button" accessibilityLabel={adding ? 'Close adding a friend' : 'Add a friend'}
        accessibilityState={{ expanded: adding }} onPress={() => { setAdding(!adding); setMessage(null); }} style={styles.addToggle}>
        <View style={{ transform: [{ rotate: adding ? '45deg' : '0deg' }] }}><HomeIcon name="plus" size={18} color={colors.secondary} /></View>
        <Type role="secondary">{adding ? 'Close' : 'Add a friend'}</Type>
      </QuietPressable>}
    </View>
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={friends.signedIn && list ? <RefreshControl refreshing={friends.refreshing} onRefresh={() => { void refresh(); }} tintColor={colors.ink} colors={[colors.ink]} /> : undefined}>
      {body}
    </ScrollView>
  </Screen></PaperBackdrop>;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  addToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 4 },
  form: { paddingTop: 8, paddingBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: colors.border },
  input: { flex: 1, minHeight: 52, fontFamily: 'ManropeRegular', fontSize: 17, color: colors.ink, paddingVertical: 10 },
  addButton: { minHeight: 48, minWidth: 56, alignItems: 'flex-end', justifyContent: 'center' },
  formNote: { marginTop: 10, minHeight: 20 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: LINE, marginTop: 8 },
  rowFrame: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, minHeight: 80 },
  mark: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(232,214,184,0.55)', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: serifFont, fontSize: 22, lineHeight: 28, color: colors.ink },
  removeLine: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: -6, paddingBottom: 6 },
  smallAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  // A request rests on a soft sand card, set apart from friends without a line or a colour.
  request: { gap: 2, padding: 18, marginTop: 8, marginBottom: 8, borderRadius: 20, backgroundColor: 'rgba(232,214,184,0.42)' },
  kicker: { fontSize: 11.5, lineHeight: 16, letterSpacing: 2.2, marginBottom: 4 },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  pill: { minHeight: 44, paddingHorizontal: 22, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  invited: { marginTop: 20 },
  invitedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  footnote: { textAlign: 'center', marginTop: 32, fontSize: 13, lineHeight: 19, paddingHorizontal: 12 },
});
