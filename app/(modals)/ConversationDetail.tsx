import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function ConversationDetail() {
  const { transcription, audioUri, audioBase64 } = useLocalSearchParams<{
    transcription: string;
    audioUri: string;
    audioBase64?: string;
  }>();

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
        console.log('[ConversationDetail] Audio mode configured for playback without interrupting recording');
      } catch (error) {
        console.error('[ConversationDetail] Failed to configure audio mode:', error);
      }
    })();
  }, []);

  async function playAudio() {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      return;
    }

    try {
      let uriToPlay = audioUri;

      // If we're on web and blob URI is likely broken, try to recreate it from base64
      if (Platform.OS === 'web' && audioUri?.startsWith('blob:')) {
        console.log('[Web Playback] Attempting to restore from Base64');
        if (audioBase64) {
          const binary = atob(audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }

          const blob = new Blob([bytes], { type: 'audio/webm' });
          uriToPlay = URL.createObjectURL(blob);
          console.log('[Web Playback] Blob URI recreated from base64');
        } else {
          throw new Error('Audio URL expired and no base64 data found.');
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync({ uri: uriToPlay });
      setSound(newSound);
      setIsPlaying(true);
      await newSound.playAsync();
    } catch (error) {
      console.error('[Playback Error]', error);
      Alert.alert('Errore nella riproduzione audio', String(error));
    }
  }

  async function shareTranscription() {
    try {
      const fileUri = `${FileSystem.cacheDirectory}transcription.txt`;
      await FileSystem.writeAsStringAsync(fileUri, transcription, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      Alert.alert('Errore durante la condivisione', String(error));
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.transcriptionContainer}>
        <Text style={styles.transcription}>{transcription}</Text>
      </ScrollView>

      <TouchableOpacity
        style={styles.loadMoreButton}
        onPress={() => Alert.alert('Carica altro...', 'Funzionalità in arrivo')}
      >
        <Text style={styles.loadMoreText}>⬇️ Carica altro...</Text>
      </TouchableOpacity>

      <View style={styles.audioPlayer}>
        <TouchableOpacity onPress={playAudio} style={styles.playButton}>
          <Text style={styles.playButtonText}>
            {isPlaying ? '⏹ Ferma Audio' : '▶️ Riproduci Audio'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={shareTranscription} style={styles.shareButton}>
          <Text style={styles.shareButtonText}>📤 Esporta Trascrizione</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  transcriptionContainer: {
    flex: 3,
    padding: 20,
  },
  transcription: {
    fontSize: 18,
    lineHeight: 24,
  },
  loadMoreButton: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#eee',
  },
  loadMoreText: {
    fontSize: 16,
    color: '#333',
  },
  audioPlayer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#f2f2f2',
    paddingVertical: 16,
  },
  playButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  playButtonText: {
    color: 'white',
    fontSize: 16,
  },
  shareButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
  },
});
