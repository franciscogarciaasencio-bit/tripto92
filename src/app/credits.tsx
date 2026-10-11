import { Link, router } from 'expo-router';
import { View } from 'react-native';
import { Header, Screen, Type } from '@/ui/primitives';

export default function Credits() {
  return <Screen><Header title="Sound credits" back={() => router.back()} />
    <View style={{ gap: 24, paddingTop: 32 }}>
      <Type role="heading">Meditation Choir</Type>
      <Type>zazz.sound.design</Type>
      <Type role="secondary">The original recording is bundled unchanged.</Type>
      <Type role="secondary">CC0 — public domain dedication. No attribution required.</Type>
      <Link href="https://creativecommons.org/publicdomain/zero/1.0/" accessibilityLabel="CC0 public domain dedication" style={{ paddingVertical: 12 }}><Type>Read the license ↗</Type></Link>
    </View>
  </Screen>;
}
