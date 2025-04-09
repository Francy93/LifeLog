// app/(tabs)/index.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform as RNPlatform,
} from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '../../constants/Colors';
import { useTimeLimit } from '../../hooks';
import { useSegmentContext } from '../../components/SegmentContext';
import {
  startRecordingChunk,
  stopRecordingChunk,
  UnifiedRecorder,
  processAndSaveSegment,
} from '../../services/recordingService';
import {
  cleanupOldSegmentsIfLowStorage,
  Segment,
  loadSegments,
  saveSegments,
} from '../../services/storageService';
import { enforceTimeLimit } from '../../services/timeManager';

if (typeof window !== 'undefined') {
  const SpeechRecognition =
    (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('[SpeechRecognition] Not supported in this browser');
  } else {
    console.log('[SpeechRecognition] API loaded');
  }
}

export default function MainPage() {
  const router = useRouter();

  const currentRecorderRef = useRef<UnifiedRecorder>(null);
  const recordingStartRef = useRef<number | null>(null);
  const shouldRecordRef = useRef<boolean>(true);
  const recordingIntervalRef = useRef<any>(null);
  const recordingRef = useRef<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSegments, setFilteredSegments] = useState<Segment[]>([]);

  const { days, hours, minutes, setDays, setHours, setMinutes } = useTimeLimit();
  const { segments, setSegments, recording, setRecording } = useSegmentContext();

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSegments([]);
      return;
    }
    const filtered = segments.filter((s) =>
      s.transcription.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredSegments(filtered);
  }, [searchQuery, segments]);

  const startContinuousRecording = async () => {
    console.log('[Recording] startContinuousRecording called');

    shouldRecordRef.current = true;

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    setRecording(true);

    const firstRecorder = await startRecordingChunk();
    const firstStart = Date.now();
    currentRecorderRef.current = firstRecorder;
    recordingStartRef.current = firstStart;

    recordingIntervalRef.current = setInterval(async () => {
      if (!shouldRecordRef.current) return;
      const oldRecorder = currentRecorderRef.current;
      const oldStart = recordingStartRef.current;

      const newRecorder = await startRecordingChunk();
      const newStart = Date.now();
      currentRecorderRef.current = newRecorder;
      recordingStartRef.current = newStart;

      if (oldRecorder && oldStart) {
        const result = await stopRecordingChunk(oldRecorder);
        const end = Date.now();

        if (!result) return;

        const segment = await processAndSaveSegment(result.uri, oldStart, end, result.base64 || '');
        if (segment) {
          const updated = [...segments, segment];
          const limited = enforceTimeLimit(updated, days.toString(), hours.toString(), minutes.toString());
          setSegments(limited);
          await saveSegments(limited);
        }
      }
    }, 30000);
  };

  const stopContinuousRecording = async () => {
    shouldRecordRef.current = false;
    setRecording(false);

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    const lastRecorder = currentRecorderRef.current;
    const lastStart = recordingStartRef.current;

    if (lastRecorder && lastStart) {
      const result = await stopRecordingChunk(lastRecorder);
      const end = Date.now();
      if (!result) return;

      const segment = await processAndSaveSegment(result.uri, lastStart, end, result.base64 || '');
      if (segment) {
        const updated = [...segments, segment];
        const limited = enforceTimeLimit(updated, days.toString(), hours.toString(), minutes.toString());
        setSegments(limited);
        await saveSegments(limited);
      }
    }
    currentRecorderRef.current = null;
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={RNPlatform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search conversations..."
          placeholderTextColor={Colors.light.text}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <View style={styles.centerContent}>
          <TouchableOpacity
            style={styles.recordButton}
            onPress={() => {
              if (recordingRef.current) {
                stopContinuousRecording();
              } else {
                startContinuousRecording();
              }
            }}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {recording ? 'Stop Recording' : 'Start Recording'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.timeContainer}>
          {['Days', 'Hours', 'Minutes'].map((label, i) => {
            const values = [days, hours, minutes];
            const setters = [setDays, setHours, setMinutes];
            return (
              <View key={label} style={styles.timeField}>
                <Text style={styles.timeLabel}>{label}</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={values[i]}
                  onChangeText={setters[i]}
                />
              </View>
            );
          })}
        </View>

        {filteredSegments.length > 0 && (
          <FlatList
            data={filteredSegments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
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
                      wordsJson: JSON.stringify((item as any).words || []),
                    },
                  })
                }
              >
                <View style={styles.segmentItem}>
                  <Text style={styles.segmentTime}>
                    {new Date(item.timestampEnd).toLocaleTimeString()}
                  </Text>
                  <Text style={styles.segmentPreview}>
                    {item.transcription.slice(0, 50)}...
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 20, backgroundColor: Colors.light.background },
  searchBar: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recordButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  buttonText: { fontSize: 18, color: '#fff' },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timeField: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  timeLabel: { fontSize: 14, marginBottom: 5 },
  timeInput: {
    height: 40,
    width: 60,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
  },
  segmentItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  segmentTime: {
    fontSize: 12,
    color: '#666',
  },
  segmentPreview: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
