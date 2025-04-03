import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function ConversationDetail() {
  const { transcription, audioUri } = useLocalSearchParams<{
    transcription: string;
    audioUri: string;
  }>();

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  async function playAudio() {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      return;
    }

    try {
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioUri });
      setSound(newSound);
      setIsPlaying(true);
      await newSound.playAsync();
    } catch (error) {
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
      {/* 📝 Trascrizione Scrollabile */}
      <ScrollView style={styles.transcriptionContainer}>
        <Text style={styles.transcription}>{transcription}</Text>
      </ScrollView>

      {/* 🔄 Carica altro (placeholder) */}
      <TouchableOpacity
        style={styles.loadMoreButton}
        onPress={() => Alert.alert('Carica altro...', 'Funzionalità in arrivo')}
      >
        <Text style={styles.loadMoreText}>⬇️ Carica altro...</Text>
      </TouchableOpacity>

      {/* 🎵 Audio Player + Export */}
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
