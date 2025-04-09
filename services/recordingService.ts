// services/recordingService.ts
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { transcribeAudioOffline, transcribeWithGoogleAPI } from './transcriptionService';

export type UnifiedRecorder = MediaRecorder | Audio.Recording | null;

export const startRecordingChunk = async (): Promise<UnifiedRecorder> => {
  try {
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      console.log('[startRecordingChunk] Web platform detected');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64000
      });
      mediaRecorder.start();
      console.log('[startRecordingChunk] Web recorder started');
      return mediaRecorder;
    }

    if (Platform.OS !== 'web') {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) throw new Error('Missing audio recording permissions.');

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      console.log('[startRecordingChunk] Native recorder started');
      return recording;
    }

    return null;
  } catch (error) {
    console.error('[startRecordingChunk] Error starting recording:', error);
    return null;
  }
};

export const stopRecordingChunk = async (
  recorder: UnifiedRecorder
): Promise<{ uri: string; base64?: string } | null> => {
  return new Promise((resolve) => {
    if (!recorder) {
      console.warn('[stopRecordingChunk] No active recorder');
      resolve(null);
      return;
    }

    if (Platform.OS === 'web' && recorder instanceof MediaRecorder) {
      console.log('[stopRecordingChunk] Stopping web recorder');
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => chunks.push(event.data);

      recorder.onstop = async () => {
        console.log('[stopRecordingChunk] Web recording stopped');
        const audioBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
        const blobUrl = URL.createObjectURL(audioBlob);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          console.log('[stopRecordingChunk] Web audio converted to base64, length:', base64.length);
          resolve({ uri: blobUrl, base64 });
        };
        reader.onerror = (err) => {
          console.error('[stopRecordingChunk] Base64 conversion error:', err);
          resolve({ uri: blobUrl });
        };

        reader.readAsDataURL(audioBlob);
      };

      recorder.stop();
    } else if (Platform.OS !== 'web' && recorder instanceof Audio.Recording) {
      console.log('[stopRecordingChunk] Stopping native recorder');
      recorder
        .stopAndUnloadAsync()
        .then(async () => {
          const originalUri = recorder.getURI();
          if (!originalUri) {
            console.error('[stopRecordingChunk] Native URI not found');
            resolve(null);
            return;
          }

          const filename = `audio_${Date.now()}.m4a`;
          const newPath = FileSystem.documentDirectory + filename;

          try {
            await FileSystem.moveAsync({ from: originalUri, to: newPath });
            console.log('[stopRecordingChunk] Native audio moved to:', newPath);
            resolve({ uri: newPath });
          } catch (moveError) {
            console.error('[stopRecordingChunk] Move error:', moveError);
            resolve({ uri: originalUri });
          }
        })
        .catch((err) => {
          console.error('[stopRecordingChunk] Unload error:', err);
          resolve(null);
        });
    } else {
      console.warn('[stopRecordingChunk] Unknown platform or recorder');
      resolve(null);
    }
  });
};

export const processAndSaveSegment = async (
  audioUri: string,
  timestamp: number,
  base64: string = ''
) => {
  console.log('[processAndSaveSegment] Started for timestamp:', timestamp);
  let transcription;

  try {
    if (Platform.OS === 'web') {
      transcription = await transcribeWithGoogleAPI(base64);
    } else {
      transcription = await transcribeAudioOffline();
    }
    console.log('[processAndSaveSegment] Transcription received:', transcription?.text);
  } catch (err) {
    console.error('[processAndSaveSegment] Transcription error:', err);
    return;
  }

  if (!transcription || !transcription.text.trim()) {
    console.warn('[processAndSaveSegment] Skipping segment due to empty transcription');
    try {
      await FileSystem.deleteAsync(audioUri, { idempotent: true });
      console.log('[processAndSaveSegment] Deleted empty audio segment');
    } catch (delErr) {
      console.error('[processAndSaveSegment] Failed to delete empty audio:', delErr);
    }
    return;
  }

  const fullTranscript = transcription.text;

  const segment = {
    id: Date.now().toString(),
    timestampStart: timestamp,
    timestampEnd: timestamp + 30 * 1000,
    durationMillis: 30 * 1000,
    transcription: fullTranscript,
    audioUri: audioUri,
    audioBase64: base64,
    words: transcription.words ?? [],
  };

  console.log('[processAndSaveSegment] Segment ready:', segment);
  return segment;
};
