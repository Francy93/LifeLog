// Updated AudioPlayer: unified generateWaveformPeaks using audioBase64 for web and mobile
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  GestureResponderEvent,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

interface AudioPlayerProps {
  audioUri: string;
  audioBase64?: string;
  timestampStart: number;
  duration: number;
}

export default function AudioPlayer({ audioUri, audioBase64, timestampStart, duration }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis] = useState(duration);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [isReady, setIsReady] = useState(false);

  const visualizerWidth = Dimensions.get('window').width - 150;
  const barSpacing = 2;
  const barWidth = 4;
  const barCount = Math.floor(visualizerWidth / (barWidth + barSpacing));

  const soundRef = useRef<Audio.Sound | null>(null);
  const visualizerRef = useRef<View>(null);

  useEffect(() => {
    (async () => {
      if (audioBase64) {
        await generateWaveformPeaks(audioBase64);
      } else {
        // fallback: show random placeholder waveform
        const fallback = Array(barCount)
          .fill(0)
          .map((_, i) => {
            const t = i / barCount;
            const base = Math.sin(25 * Math.PI * t); // high-frequency wave
            const noise = (Math.random() - 0.5) * 0.3; // small noise
            return Math.max(0, Math.min(1, 0.5 + 0.5 * base + noise));
          });

        setWaveformPeaks(fallback);
      }
      await loadSound();
    })();
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, [audioUri]);

  const updateStatus = (status: any) => {
    if (status.isLoaded) {
      setPositionMillis(status.positionMillis);
      setIsPlaying(status.isPlaying);
    }
  };

  async function loadSound() {
    try {
      let uriToPlay = audioUri;
      if (Platform.OS === 'web' && audioUri.startsWith('blob:') && audioBase64) {
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/webm' });
        uriToPlay = URL.createObjectURL(blob);
      }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: uriToPlay },
        { shouldPlay: false },
        updateStatus
      );
      soundRef.current = newSound;
      setIsReady(true);
    } catch (error) {
      console.error('[Load Error]', error);
      Alert.alert('Errore nel caricamento audio', String(error));
    }
  }

  async function generateWaveformPeaks(base64: string) {
    try {
      const binary = atob(base64);
      const byteArray = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) byteArray[i] = binary.charCodeAt(i);

      const sampleRate = 44100;
      const chunkSize = sampleRate / 30;
      const peaks: number[] = [];
      for (let i = 0; i < byteArray.length; i += chunkSize) {
        let sum = 0;
        for (let j = i; j < i + chunkSize && j < byteArray.length; j++) {
          sum += Math.abs(byteArray[j] - 128);
        }
        peaks.push(sum / chunkSize);
      }
      const max = Math.max(...peaks) || 1;
      setWaveformPeaks(peaks.map(p => Math.min(p / max, 1)));
    } catch (error) {
      console.error('Waveform generation failed:', error);
    }
  }

  async function playAudio() {
    if (!soundRef.current || !isReady) return;
    const status = await soundRef.current.getStatusAsync();
    if (status.isLoaded) {
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    }
  }

  const changePlaybackSpeed = async () => {
    const newSpeed = playbackSpeed === 1.0 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
    setPlaybackSpeed(newSpeed);
    if (soundRef.current) await soundRef.current.setRateAsync(newSpeed, true);
  };

  async function downloadAudio() {
    try {
      if (Platform.OS === 'web') {
        if (!audioBase64) throw new Error('Base64 not available for download');
        const blob = new Blob([
          Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))
        ], { type: 'audio/wav' });
  
        const a = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(blob),
          download: 'audio.wav',
        });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      } else {
        await Sharing.shareAsync(audioUri);
      }
    } catch (error) {
      Alert.alert('Errore durante il download', String(error));
    }
  }


  const handleSeek = (event: GestureResponderEvent) => {
    if (!soundRef.current || !isReady || !visualizerRef.current || !isFinite(durationMillis)) return;
    visualizerRef.current.measure((_x, _y, width, _height, pageX) => {
      const tapX = event.nativeEvent.pageX - pageX;
      const ratio = Math.min(1, Math.max(0, tapX / width));
      const newPosition = ratio * durationMillis;
      soundRef.current!.setPositionAsync(newPosition);
      setPositionMillis(newPosition);
    });
  };

  const renderBars = () => {
    const progressRatio = durationMillis > 0 && isFinite(durationMillis)
      ? positionMillis / durationMillis
      : 0;

    return (
      <View
        ref={visualizerRef}
        style={styles.visualizer}
        onStartShouldSetResponder={() => true}
        onResponderMove={handleSeek}
        onResponderRelease={handleSeek}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {Array.from({ length: barCount }, (_, index) => {
            const value = waveformPeaks[index] || 0;
            const barFilled = index / barCount <= progressRatio;
            return (
              <View
                key={index}
                style={{
                  height: 10 + Math.pow(value, 40) * 30,
                  width: barWidth,
                  marginHorizontal: barSpacing / 2,
                  backgroundColor: barFilled ? '#007AFF' : '#ccc',
                  borderRadius: 2,
                }}
              />
            );
          })}
          <View style={[styles.progressIndicator, {
            left: progressRatio * barCount * (barWidth + barSpacing) - 10 + (barSpacing / 2),
          }]} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.playerHeader}>
        <TouchableOpacity style={styles.speedButton} onPress={changePlaybackSpeed}>
          <Text style={styles.playButtonText}>{playbackSpeed}x</Text>
        </TouchableOpacity>
        <View style={styles.visualizerWrapper}>{renderBars()}</View>
        <View style={styles.timestampWrapper}>
          <View style={styles.timestamp}>
            <Text style={styles.timestampTime}>
              {new Date(timestampStart + positionMillis).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.navButton} onPress={() => Alert.alert('Segmento precedente')}>
            <Ionicons name="play-skip-back" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={playAudio} style={styles.playButton}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={() => Alert.alert('Segmento successivo')}>
            <Ionicons name="play-skip-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.downloadIconWrapper} onPress={downloadAudio}>
          <MaterialIcons name="file-download" size={28} color="#6C63FF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timestamp: { flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  timestampTime: { fontSize: 12, color: '#888' },
  timestampWrapper: { alignItems: 'flex-end', width: 50 },
  container: { paddingVertical: 16, backgroundColor: '#fafafa' },
  playerHeader: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  visualizerWrapper: { flex: 1, marginHorizontal: 0 },
  visualizer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 40, overflow: 'hidden',
  },
  progressIndicator: {
    position: 'absolute', width: 20, height: 20, backgroundColor: '#007AFF', borderRadius: 10, top: '50%', marginTop: -10, // centers vertically
  },
  speedButton: {
    backgroundColor: '#FFA500', padding: 12, borderRadius: 50, width: 50, height: 50, alignItems: 'center', justifyContent: 'center',
  },
  controlsContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 20, marginTop: 10, position: 'relative',
  },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  navButton: {
    backgroundColor: '#999', padding: 12, borderRadius: 50, width: 50, height: 50, alignItems: 'center', justifyContent: 'center',
  },
  playButton: {
    backgroundColor: '#007AFF', padding: 12, borderRadius: 50, width: 50, height: 50, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10,
  },
  playButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  downloadIconWrapper: { position: 'absolute', right: 20, padding: 8 },
});
