import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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

  const loadSegments = async () => {
    try {
      console.log('[Timeline] loadSegments called...');
      const stored = await AsyncStorage.getItem('segments');
      if (stored) {
        const parsed: Segment[] = JSON.parse(stored);
        // Sort chronologically (latest first)
        setSegments(parsed.sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setSegments([]);
      }
    } catch (error) {
      console.error('[Timeline] Error loading segments:', error);
    }
  };

  // Re-fetch segments each time Timeline is in the foreground,
  // and whenever we get a 'segmentsUpdated' event from storageService
  useFocusEffect(
    useCallback(() => {
      console.log('[Timeline] Screen focused, reloading segments...');
      loadSegments();

      // Subscribe to "segmentsUpdated" event
      const subscription = DeviceEventEmitter.addListener('segmentsUpdated', () => {
        console.log('[Timeline] "segmentsUpdated" event received, reloading segments...');
        loadSegments();
      });

      return () => {
        // Unsubscribe on blur
        console.log('[Timeline] Screen unfocused, removing subscription');
        subscription.remove();
      };
    }, [])
  );

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
                {new Date(item.timestamp).toLocaleDateString()}{' '}
                {new Date(item.timestamp).toLocaleTimeString()}
              </Text>
              <Text style={styles.preview}>
                {item.transcription.slice(0, 80)}...
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
