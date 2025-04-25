// app/(tabs)/index.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
const CHUNK_INTERVAL_MS = 30_000; // 30 seconds

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

  // -------------------------------------------------------------------
  //  Internal helpers
  // -------------------------------------------------------------------
  const appendSegment = (segment: Segment) => {
    setSegments(prev => {
      const limited = enforceTimeLimit(
        [...prev, segment],
        days.toString(),
        hours.toString(),
        minutes.toString(),
      );
      saveSegments(limited);
      return limited;
    });
  };

  // -------------------------------------------------------------------
  //  Recording helpers for chunking
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

  // keep ref of recording
  useEffect(() => {
    isRecordingRef.current = recording;
  }, [recording]);

  // -------------------------------------------------------------------
  //  Recording flow for chunking
  // -------------------------------------------------------------------
  const startContinuousRecording = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    setRecording(true);

    recorderRef.current = await startRecordingChunk();
    chunkStartRef.current = Date.now();

    intervalRef.current = setInterval(async () => {
      if (!isRecordingRef.current) return;

      const prevRecorder = recorderRef.current;
      const prevStart = chunkStartRef.current;

      recorderRef.current = await startRecordingChunk();
      chunkStartRef.current = Date.now();

      if (prevRecorder && prevStart !== null) {
        await finalizeChunk(prevRecorder, prevStart);
      }
    }, CHUNK_INTERVAL_MS);
  };

  // -------------------------------------------------------------------
  //  Stop recording and finalize the last chunk
  // -------------------------------------------------------------------
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
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------
//  Styles (unchanged except searchBar removed)
// ---------------------------------------------------------------------
const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 20, backgroundColor: Colors.light.background },
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
});
