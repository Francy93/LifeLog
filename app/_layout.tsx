// app/_layout.tsx
import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { SegmentProvider } from '../components/SegmentContext';

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          shouldDuckAndroid: false,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          playThroughEarpieceAndroid: false,
        });
        console.log('[Audio Mode] Configured');
      } catch (e) {
        console.error('[Audio Mode] Failed:', e);
      }
    })();
  }, []);

  return (
    <SegmentProvider>
      <Slot />
    </SegmentProvider>
  );
}
