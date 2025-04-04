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
} from '../../services/recordingService';
import { enforceTimeLimit } from '../../services/timeManager';
import { cleanupOldSegmentsIfLowStorage, saveSegments } from '../../services/storageService';


export default function MainPage() {
  const router = useRouter();

  // 🧠 Ref to store the currently active recorder (rotated every 30s)
  const currentRecorderRef = useRef<UnifiedRecorder>(null);

  // 🧠 Ref used to block further chunk rotation after recording is stopped
  const shouldRecordRef = useRef<boolean>(true);

  // 📶 Tracks the current interval between chunks
  const recordingIntervalRef = useRef<any>(null);

  // 🔄 UI State
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSegments, setFilteredSegments] = useState<typeof segments>([]);

  // ⏳ Time limit management
  const { days, hours, minutes, setDays, setHours, setMinutes } = useTimeLimit();

  // 📼 Global recording state & segment management from context
  const { segments, setSegments, addSegment, recording, setRecording } = useSegmentContext();



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

  /**
   * Start the continuous recording process
   *  - Immediately start first recording
   *  - Start setInterval for chunk rotation every 30s
   */
  const startContinuousRecording = async () => {
    console.log('[Recording] startContinuousRecording called');

    shouldRecordRef.current = true;
  
    if (recordingIntervalRef.current) {
      console.warn('[Recording] Duplicate interval detected. Clearing existing interval.');
      clearInterval(recordingIntervalRef.current);
    }
  
    shouldRecordRef.current = true;
    setRecording(true);
  
    const firstRecorder = await startRecordingChunk();
    currentRecorderRef.current = firstRecorder;
  
    recordingIntervalRef.current = setInterval(async () => {
      if (!shouldRecordRef.current) {
        console.warn('[Interval Tick] Skipped — recording has been stopped.');
        return;
      }
  
      console.log('[Interval Tick] 30s chunk rotation triggered');
  
      try {
        const newRecorder = await startRecordingChunk();
        const oldRecorder = currentRecorderRef.current;
        currentRecorderRef.current = newRecorder;
  
        if (oldRecorder) {
          const audioUri = await stopRecordingChunk(oldRecorder);
          if (!audioUri) {
            console.warn('[Chunk Finalize] No audio URI to save.');
            return;
          }
  
          const timestamp = Date.now();
          const newSegment = {
            id: String(timestamp),
            timestamp,
            transcription: 'Simulated transcription',
            audioUri,
          };
  
          setSegments((prevSegments) => {
            const appended = [...prevSegments, newSegment].sort((a, b) => a.timestamp - b.timestamp);
            const limited = enforceTimeLimit(appended, days, hours, minutes);
            saveSegments(limited);
            console.log(`[Segment Save] Total stored: ${limited.length}`);
            return limited;
          });
        }
      } catch (err) {
        console.error('[Recording Interval Error]', err);
      }
    }, 30000);
  
    console.log('[Recording] Interval started');
  };
  

  /**
   * Stop the continuous recording process
   *  - Clear the interval
   *  - Finalize the last active recorder
   */
  const stopContinuousRecording = async () => {
    console.log('[DEBUG] stopContinuousRecording() called');
    console.log('[Stop] Attempting to stop recording...');
  
    // ⛔️ Block further chunk rotation
    shouldRecordRef.current = false;
  
    // 🔕 Update visual UI state
    setRecording(false);
  
    // 🧹 Clear the active interval if it's still running
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
      console.log('[Stop] Cleared recording interval.');
    }
  
    // 📼 Finalize last active recorder
    const lastRecorder = currentRecorderRef.current;
    if (lastRecorder) {
      await finalizeChunk(lastRecorder);
      currentRecorderRef.current = null;
      console.log('[Stop] Finalized last recorder.');
    } else {
      console.log('[Stop] No active recorder to finalize.');
    }
  };
  

  /**
   * finalizeChunk
   *  - Stop the provided recorder
   *  - Create a new segment
   *  - Save it to local/AsyncStorage
   */
  const finalizeChunk = async (recorder: UnifiedRecorder) => {
    const audioUri = await stopRecordingChunk(recorder);
    if (!audioUri) {
      console.log('No audio URI. Possibly an error or no data recorded.');
      return;
    }
    const timestamp = Date.now();
    const newSegment = {
      id: String(timestamp),
      timestamp,
      transcription: 'Simulated transcription', // or real transcription
      audioUri,
    };
    await addSegment(newSegment);
    await cleanupOldSegmentsIfLowStorage(100);
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
                    params: { transcription: item.transcription, audioUri: item.audioUri },
                  })
                }
              >
                <View style={styles.segmentItem}>
                  <Text style={styles.segmentTime}>
                    {new Date(item.timestamp).toLocaleTimeString()}
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
