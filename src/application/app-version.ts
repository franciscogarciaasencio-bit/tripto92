import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * "Ona 1.2.0", plus the date of the over-the-air update the app is running, when it is one
 * (EAS Update, docs/ANDROID_BUILD.md). Lets the owner see that a published update has arrived.
 */
export function appVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? null;
  let update: string | null = null;
  try {
    if (Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.createdAt) {
      update = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(Updates.createdAt);
    }
  } catch { update = null; }
  return `Ona${version ? ` ${version}` : ''}${update ? ` · update of ${update}` : ''}`;
}
