import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  DeviceEventEmitter,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

interface Segment {
  id: string;
  timestampStart: number;
  timestampEnd: number;
  durationMillis: number;
  transcription: string;
  audioUri: string;
  audioBase64: string;
}

export default function Timeline() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Segment | null>(null);

  const router = useRouter();

  const loadSegments = async () => {
    try {
      const stored = await AsyncStorage.getItem('segments');
      if (stored) {
        const parsed: Segment[] = JSON.parse(stored);
        setSegments(parsed.sort((a, b) => b.timestampEnd - a.timestampEnd));
      } else {
        setSegments([]);
      }
    } catch (error) {
      console.error('[Timeline] Error loading segments:', error);
    }
  };

  const confirmDeleteSegment = (segment: Segment) => {
    setPendingDelete(segment);
    setModalVisible(true);
  };

  const performDelete = async () => {
    if (!pendingDelete) return;

    const { id, audioUri } = pendingDelete;
    console.log('[Delete] Confirmed for ID:', id);

    try {
      if (audioUri.startsWith('file://')) {
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(audioUri, { idempotent: true });
          console.log('[Delete] Audio file deleted:', audioUri);
        }
      } else {
        console.log('[Delete] Skipping file deletion for web blob URI');
      }

      const stored = await AsyncStorage.getItem('segments');
      if (stored) {
        const allSegments: Segment[] = JSON.parse(stored);
        const updatedSegments = allSegments.filter((s) => s.id !== id);
        await AsyncStorage.setItem('segments', JSON.stringify(updatedSegments));
        setSegments(updatedSegments);
        DeviceEventEmitter.emit('segmentsUpdated');
        console.log('[Delete] Segment removed from AsyncStorage');
      }
    } catch (error) {
      console.error('[Delete] Error deleting segment:', error);
    }

    setModalVisible(false);
    setPendingDelete(null);
  };

  useFocusEffect(
    useCallback(() => {
      loadSegments();
      const subscription = DeviceEventEmitter.addListener('segmentsUpdated', loadSegments);
      return () => subscription.remove();
    }, [])
  );

  const renderSegment = ({ item }: { item: Segment }) => (
    <View style={styles.item}>
      <TouchableOpacity
        style={styles.content}
        activeOpacity={0.7}
        onPress={() =>
          router.push({
            pathname: '/ConversationDetail',
            params: {
              transcription: item.transcription,
              audioUri: item.audioUri,
              audioBase64: item.audioBase64 ?? '',
              timestampStart: item.timestampStart?.toString(),
              timestampEnd: item.timestampEnd?.toString(),
              durationMillis: item.durationMillis?.toString(),
            },
          })
        }
      >
        <Text style={styles.timestamp}>
          {new Date(item.timestampEnd).toLocaleDateString()}{' '}
          {new Date(item.timestampEnd).toLocaleTimeString()} ({Math.round(item.durationMillis / 1000)}s)
        </Text>
        <Text style={styles.preview}>{item.transcription.slice(0, 80)}...</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        activeOpacity={0.6}
        onPress={() => confirmDeleteSegment(item)}
      >
        <Ionicons name="trash-outline" size={20} color="red" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {segments.length === 0 ? (
        <Text style={styles.emptyMessage}>No transcript available</Text>
      ) : (
        <FlatList
          data={segments}
          keyExtractor={(item) => item.id}
          renderItem={renderSegment}
        />
      )}

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Confirm deletion</Text>
            <Text style={styles.modalMessage}>
              Do you want to delete this segment?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setPendingDelete(null);
                }}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={performDelete}
                style={[styles.modalButton, styles.confirmButton]}
              >
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  content: {
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: 'gray',
  },
  preview: {
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    marginLeft: 10,
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  confirmButton: {
    backgroundColor: '#ff3b30',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
