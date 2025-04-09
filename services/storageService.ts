// services/storageService.ts
import { Platform, DeviceEventEmitter } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Segment {
  id: string;
  timestampStart: number;
  timestampEnd: number;
  durationMillis: number;
  transcription: string;
  audioUri: string;
  audioBase64: string;
  words?: { word: string; startTime: number; endTime: number }[];
}

const STORAGE_KEY = 'segments';

export async function loadSegments(): Promise<Segment[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('[Storage] Failed to load segments:', error);
    return [];
  }
}

export async function saveSegments(segments: Segment[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(segments));
    DeviceEventEmitter.emit('segmentsUpdated');
  } catch (error) {
    console.error('[Storage] Failed to save segments:', error);
  }
}

export async function cleanupOldSegmentsIfLowStorage(thresholdInMB: number = 100): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const info = await FileSystem.getFreeDiskStorageAsync();
    const freeMB = info / (1024 * 1024);

    if (freeMB > thresholdInMB) return;

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const segments = JSON.parse(raw) as Segment[];
    const sorted = [...segments].sort((a, b) => a.timestampEnd - b.timestampEnd);

    for (let i = 0; i < sorted.length; i++) {
      try {
        await FileSystem.deleteAsync(sorted[i].audioUri, { idempotent: true });
      } catch (err) {
        console.warn(`[Storage] Failed to delete audio file: ${sorted[i].audioUri}`);
      }

      sorted.splice(i, 1);

      const newFree = await FileSystem.getFreeDiskStorageAsync() / (1024 * 1024);
      if (newFree > thresholdInMB) break;
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    DeviceEventEmitter.emit('segmentsUpdated');
  } catch (error) {
    console.error('[Storage] Error during automatic cleanup:', error);
  }
}
