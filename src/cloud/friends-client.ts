import type { CloudConfig } from './config';
import { CloudError, createRestClient, responseList, responseRecord, type FetchLike } from './rest';

/** A friend: both of you added each other. Only what they share: name, level and weeks in a row. */
export interface Friend {
  readonly id: string;
  readonly name: string;
  /** Null until their app first shares it. */
  readonly level: number | null;
  /** Weeks in a row and the last day they hold without more practice; null until shared. */
  readonly streak: { readonly weeks: number; readonly until: string } | null;
}
/** Someone who added you and whom you have not added (or put aside) yet. */
export interface FriendRequest { readonly id: string; readonly name: string; readonly email: string }
export interface FriendsList {
  readonly friends: readonly Friend[];
  readonly requests: readonly FriendRequest[];
  /** Addresses you added that have not added you. */
  readonly invited: readonly string[];
}
/** 'invited' never says whether the address uses Ona; 'friends': they had already added you. */
export type AddFriendResult = 'friends' | 'invited' | 'self';
export interface SharedProgress { readonly level: number; readonly weeks: number; readonly until: string }

export interface CloudFriends {
  share(progress: SharedProgress): Promise<void>;
  list(): Promise<FriendsList>;
  add(email: string): Promise<AddFriendResult>;
  /** Remove a friend, or put their request aside. */
  remove(friendId: string): Promise<void>;
  /** Withdraw an unanswered invitation. */
  cancel(email: string): Promise<void>;
}

/** The shape the database checks too, so obvious typos are caught before a round trip. */
export const looksLikeEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim()) && value.trim().length <= 320;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const fail = (): never => { throw new CloudError('server', 'Unexpected friends response'); };
const id = (value: unknown) => typeof value === 'string' && UUID.test(value) ? value : fail();
const text = (value: unknown, max: number) => typeof value === 'string' && value.length >= 1 && value.length <= max ? value : fail();
const whole = (value: unknown, max: number) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : fail();

function friend(value: unknown): Friend {
  const row = responseRecord(value);
  const level = row.level === null ? null : whole(row.level, 125);
  const streak = row.weeks === null || row.weeksUntil === null ? null : {
    weeks: whole(row.weeks, 1000),
    until: typeof row.weeksUntil === 'string' && DATE.test(row.weeksUntil) ? row.weeksUntil : fail(),
  };
  return { id: id(row.id), name: text(row.name, 80), level, streak };
}
function request(value: unknown): FriendRequest {
  const row = responseRecord(value);
  return { id: id(row.id), name: text(row.name, 80), email: text(row.email, 320) };
}

/** Friends over Supabase RPC (supabase/migrations/20261017120000_ona_friends.sql), for one account. */
export function createSupabaseFriends(config: CloudConfig, accessToken: () => Promise<string | null>, fetchImpl?: FetchLike): CloudFriends {
  const { rpc } = createRestClient(config, accessToken, fetchImpl);
  return {
    async share({ level, weeks, until }) {
      if (!Number.isSafeInteger(level) || level < 0 || level > 125 || !Number.isSafeInteger(weeks) || weeks < 0 || !DATE.test(until)) {
        throw new RangeError('Invalid shared progress');
      }
      await rpc('ona_share_progress', { p_level: level, p_week_streak: weeks, p_streak_until: until });
    },
    async list() {
      const result = responseRecord(await rpc('ona_friends', {}));
      return {
        friends: responseList(result.friends).map(friend),
        requests: responseList(result.requests).map(request),
        invited: responseList(result.invited).map((email) => text(email, 320)),
      };
    },
    async add(email) {
      const status = responseRecord(await rpc('ona_add_friend', { p_email: email.trim() })).status;
      return status === 'friends' || status === 'invited' || status === 'self' ? status : fail();
    },
    async remove(friendId) { await rpc('ona_remove_friend', { p_friend: id(friendId) }); },
    async cancel(email) { await rpc('ona_cancel_invitation', { p_email: email }); },
  };
}
