// services/storageService.ts
import { Platform, DeviceEventEmitter } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Segment {
  id: string;
  timestamp: number;
  transcription: string;
  audioUri: string;
  audioBase64?: string; // ✅ Added for persistent audio on web
}

const STORAGE_KEY = 'segments';

export async function loadSegments(): Promise<Segment[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('Failed to load segments:', error);
    return [];
  }
}

export async function saveSegments(segments: Segment[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(segments));
    DeviceEventEmitter.emit('segmentsUpdated');
  } catch (error) {
    console.error('Failed to save segments:', error);
  }
}

export async function cleanupOldSegmentsIfLowStorage(thresholdInMB: number = 100): Promise<void> {
  // 🚫 Skip on web because FileSystem.getFreeDiskStorageAsync is unavailable
  if (Platform.OS === 'web') return;

  try {
    const info = await FileSystem.getFreeDiskStorageAsync();
    const freeMB = info / (1024 * 1024);

    if (freeMB > thresholdInMB) return;

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const segments = JSON.parse(raw) as Segment[];
    const sorted = [...segments].sort((a, b) => a.timestamp - b.timestamp); // oldest first

    for (let i = 0; i < sorted.length; i++) {
      try {
        await FileSystem.deleteAsync(sorted[i].audioUri, { idempotent: true });
      } catch (err) {
        console.warn(`Failed to delete audio file: ${sorted[i].audioUri}`);
      }

      sorted.splice(i, 1); // Remove from memory

      const newFree = await FileSystem.getFreeDiskStorageAsync() / (1024 * 1024);
      if (newFree > thresholdInMB) break;
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    DeviceEventEmitter.emit('segmentsUpdated');
  } catch (error) {
    console.error('Errore nella pulizia automatica:', error);
  }
}
