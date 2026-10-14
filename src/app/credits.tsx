import { router } from 'expo-router';
import { View } from 'react-native';
import { Header, Screen, Type } from '@/ui/primitives';

export default function Credits() {
  return <Screen><Header title="Ona sound" back={() => router.back()} />
    <View style={{ gap: 24, paddingTop: 32 }}>
      <Type role="heading">Made for quiet practice</Type>
      <Type>Ona’s bells are acoustic singing bowls, gently refined for quiet practice. The recordings are public domain (CC0).</Type>
      <Type role="secondary">Ocean, Rain, Storm and Brown Noise are original sound designs, generated for Ona.</Type>
      <Type role="secondary">All sounds are bundled locally. No streaming, accounts or subscription.</Type>
      <Type role="heading">The original Choir</Type>
      <Type role="secondary">Meditation Choir by zazz.sound.design remains available. The supplied recording is CC0, with no mandatory attribution or licensing fees.</Type>
    </View>
  </Screen>;
}
