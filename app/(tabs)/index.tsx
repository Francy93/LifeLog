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
  Platform,
} from 'react-native';
import { Platform as RNPlatform } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../../constants/Colors';
import { useTimeLimit, useSegments } from '../hooks';
import { startRecordingChunk, stopRecordingChunk } from '../../services/recordingService';
import { transcribeAudio } from '../../services/transcriptionService';
import { enforceTimeLimit } from '../../services/timeManager';
import { cleanupOldSegmentsIfLowStorage } from '../../services/storageService';

export default function MainPage() {
  const router = useRouter();
  const recordingIntervalRef = useRef<any>(null);

  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [audioRecording, setAudioRecording] = useState<any>(null);
  const [filteredSegments, setFilteredSegments] = useState<typeof segments>([]);

  const { days, hours, minutes, setDays, setHours, setMinutes } = useTimeLimit();
  const { segments, setSegments, addSegment } = useSegments();

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSegments([]);
    } else {
      const filtered = segments.filter(s =>
        s.transcription.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSegments(filtered);
    }
  }, [searchQuery, segments]);

  const startContinuousRecording = async () => {
    setRecording(true);
    await startChunk();

    recordingIntervalRef.current = setInterval(async () => {
      await stopChunk();
      await startChunk();

      const updated = enforceTimeLimit(segments, days, hours, minutes);
      setSegments(updated);
    }, 30000); // every 30 seconds
  };

  const startChunk = async () => {
    const recording = await startRecordingChunk();
    if (recording) setAudioRecording(recording);
  };

  const stopChunk = async () => {
    if (!audioRecording || RNPlatform.OS === 'web') return;

    const audioUri = await stopRecordingChunk(audioRecording);
    if (!audioUri) return;

    const timestamp = Date.now();
    const transcription = await transcribeAudio(audioUri);

    const segment = {
      id: String(timestamp),
      timestamp,
      transcription,
      audioUri,
    };

    await addSegment(segment);
    await cleanupOldSegmentsIfLowStorage(100); // MB threshold
    setAudioRecording(null);
  };

  const stopContinuousRecording = async () => {
    setRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    await stopChunk();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                    params: {
                      transcription: item.transcription,
                      audioUri: item.audioUri,
                    },
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
