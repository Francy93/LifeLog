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
import { Segment, saveSegments } from '../../services/storageService';
import { enforceTimeLimit } from '../../services/timeManager';

// ---------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------
const CHUNK_INTERVAL_MS = 30_000; // 30 seconds

export default function MainPage() {
  const router = useRouter();

  // --- recording refs -------------------------------------------------
  const recorderRef = useRef<UnifiedRecorder | null>(null);
  const chunkStartRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // --- global state ---------------------------------------------------
  const { days, hours, minutes, setDays, setHours, setMinutes } = useTimeLimit();
  const { segments, setSegments, recording, setRecording } = useSegmentContext();

  // --- UI state -------------------------------------------------------
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSegments, setFilteredSegments] = useState<Segment[]>([]);

  // -------------------------------------------------------------------
  //  Internal helpers for managing segments
  // -------------------------------------------------------------------
  const appendSegment = (segment: Segment) => {
    setSegments(prev => {
      const limited = enforceTimeLimit(
        [...prev, segment],
        days.toString(),
        hours.toString(),
        minutes.toString(),
      );
      saveSegments(limited); // async fire‑and‑forget
      return limited;
    });
  };

  // -------------------------------------------------------------------
  // Finishes a recording chunk: stops the recorder, runs speech‑to‑text,
  // persists the new segment, and appends it to state (respecting time limit).
  // -------------------------------------------------------------------
  const finalizeChunk = async (recorder: UnifiedRecorder, start: number) => {
    const result = await stopRecordingChunk(recorder);
    if (!result) return;

    const segment = await processAndSaveSegment(
      result.uri,
      start,
      Date.now(),
      result.base64 ?? '',
    );
    if (segment) appendSegment(segment);
  };


  // -------------------------------------------------------------------
  //  Effects for loading and filtering segments
  // -------------------------------------------------------------------
  useEffect(() => {
    isRecordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSegments([]);
      return;
    }
    const lower = searchQuery.toLowerCase();
    setFilteredSegments(
      segments.filter(s => s.transcription.toLowerCase().includes(lower)),
    );
  }, [searchQuery, segments]);

  // -------------------------------------------------------------------
  //  Recording flow for chunks
  // -------------------------------------------------------------------
  const startContinuousRecording = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    setRecording(true);

    recorderRef.current = await startRecordingChunk();
    chunkStartRef.current = Date.now();

    intervalRef.current = setInterval(async () => {
      if (!isRecordingRef.current) return;

      const previousRecorder = recorderRef.current;
      const previousStart = chunkStartRef.current;

      recorderRef.current = await startRecordingChunk();
      chunkStartRef.current = Date.now();

      if (previousRecorder && previousStart !== null) {
        await finalizeChunk(previousRecorder, previousStart);
      }
    }, CHUNK_INTERVAL_MS);
  };


  // --------------------------------------------------------------------
  //  Stop recording and process the last chunk
  // --------------------------------------------------------------------
  const stopContinuousRecording = async () => {
    setRecording(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const lastRecorder = recorderRef.current;
    const lastStart = chunkStartRef.current;

    recorderRef.current = null;
    chunkStartRef.current = null;

    if (lastRecorder && lastStart !== null) {
      await finalizeChunk(lastRecorder, lastStart);
    }
  };

  // -------------------------------------------------------------------
  //  UI rendering and layout
  // -------------------------------------------------------------------
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={RNPlatform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Search bar */}
        <TextInput
          style={styles.searchBar}
          placeholder="Search conversations..."
          placeholderTextColor={Colors.light.text}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Record button */}
        <View style={styles.centerContent}>
          <TouchableOpacity
            style={styles.recordButton}
            onPress={recording ? stopContinuousRecording : startContinuousRecording}
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

        {/* Time‑limit inputs */}
        <View style={styles.timeContainer}>
          {[
            { label: 'Days', value: days, setter: setDays },
            { label: 'Hours', value: hours, setter: setHours },
            { label: 'Minutes', value: minutes, setter: setMinutes },
          ].map(({ label, value, setter }) => (
            <View key={label} style={styles.timeField}>
              <Text style={styles.timeLabel}>{label}</Text>
              <TextInput
                style={styles.timeInput}
                placeholder="0"
                keyboardType="numeric"
                value={value}
                onChangeText={setter}
              />
            </View>
          ))}
        </View>

        {/* Search results */}
        {filteredSegments.length > 0 && (
          <FlatList
            data={filteredSegments}
            keyExtractor={item => item.id}
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

// ---------------------------------------------------------------------
//  Styles
// ---------------------------------------------------------------------
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
