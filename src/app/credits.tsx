import { Link, router } from 'expo-router';
import { View } from 'react-native';
import { Header, Screen, Type } from '@/ui/primitives';

export default function Credits() {
  return <Screen><Header title="Sound credits" back={() => router.back()} />
    <View style={{ gap: 24, paddingTop: 32 }}>
      <Type role="heading">Relaxing Ocean Waves With Music</Type>
      <Type>Alexander Blu</Type>
      <Type role="secondary">Ocean waves with ambient music. The original recording is bundled unchanged.</Type>
      <Link href="https://orangefreesounds.com/relaxing-ocean-waves-with-music/" accessibilityLabel="Recording source on Orange Free Sounds" style={{ paddingVertical: 12 }}><Type>Recording source ↗</Type></Link>
      <Type role="secondary">Creative Commons Attribution 4.0 International</Type>
      <Link href="https://creativecommons.org/licenses/by/4.0/" accessibilityLabel="Creative Commons Attribution 4.0 license" style={{ paddingVertical: 12 }}><Type>Read the license ↗</Type></Link>
    </View>
  </Screen>;
}
