import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Segment {
  id: string;
  timestamp: number;
  transcription: string;
  audioUri: string;
}

export default function Timeline() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const router = useRouter();

  useEffect(() => {
    const loadSegments = async () => {
      try {
        const stored = await AsyncStorage.getItem('segments');
        if (stored) {
          const parsed: Segment[] = JSON.parse(stored);
          // Sort chronologically (latest first)
          setSegments(parsed.sort((a, b) => b.timestamp - a.timestamp));
        }
      } catch (error) {
        console.error('Errore nel caricamento dei segmenti:', error);
      }
    };
    loadSegments();
  }, []);

  return (
    <View style={styles.container}>
      {segments.length === 0 ? (
        <Text style={styles.emptyMessage}>Nessuna trascrizione disponibile</Text>
      ) : (
        <FlatList
          data={segments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() =>
                router.push({
                  pathname: '/ConversationDetail',
                  params: {
                    transcription: item.transcription,
                    audioUri: item.audioUri,
                  },
                })
              }
            >
              <Text style={styles.timestamp}>
                {new Date(item.timestamp).toLocaleDateString()} {'\n'}
                {new Date(item.timestamp).toLocaleTimeString()}
              </Text>
              <Text style={styles.preview}>
                {item.transcription.length > 0
                  ? item.transcription.slice(0, 80) + '...'
                  : '⏳ In attesa di trascrizione'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    color: 'gray',
  },
  item: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'flex-start',
  },
  timestamp: {
    width: 100,
    fontSize: 12,
    color: 'gray',
  },
  preview: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
