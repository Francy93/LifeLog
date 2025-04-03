// app/conversationDetail.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ConversationDetail() {
  // The parameters are passed as query parameters.
  const { transcription, audioUri } = useLocalSearchParams<{ transcription: string; audioUri: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.transcription}>{transcription}</Text>
      <Text style={styles.audioUri}>{audioUri}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  transcription: {
    fontSize: 18,
    marginBottom: 10,
  },
  audioUri: {
    fontSize: 14,
    color: 'gray',
  },
});
