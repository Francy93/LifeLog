// app/(modals)/ConversationDetail.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import AudioPlayer from '../../components/AudioPlayer';

export default function ConversationDetail() {
  const {
    transcription,
    audioUri,
    audioBase64,
    timestampStart,
    timestampEnd,
    durationMillis,
  } = useLocalSearchParams<{
    transcription:  string;
    audioUri:       string;
    audioBase64:    string;
    timestampStart: string;
    timestampEnd:   string;
    durationMillis: string;
  }>();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.transcriptionContainer}>
        <Text style={styles.transcription}>{transcription}</Text>

        {durationMillis && (
          <Text style={styles.durationInfo}>
            Duration: {(Number(durationMillis) / 1000).toFixed(1)}s
          </Text>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.loadMoreButton}
        onPress={() => Alert.alert('Carica altro...', 'Funzionalità in arrivo')}
      >
        <Text style={styles.loadMoreText}>⬇️ Carica altro...</Text>
      </TouchableOpacity>

      <AudioPlayer
        audioUri=       {audioUri}
        audioBase64=    {audioBase64}
        timestampStart= {Number(timestampStart)}
        duration=       {Number(durationMillis)}
      />
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
  durationInfo: {
    fontSize: 14,
    color: '#555',
    marginTop: 10,
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
});