// services/recordingService.ts
import { Platform } from 'react-native';
import { Audio } from 'expo-av'; // Expo AV for native audio recording

/**
 * We'll define a union type to unify web and native recorders.
 * In your code, you had a "type" in index.tsx, but let's keep it here for clarity.
 */
export type UnifiedRecorder = MediaRecorder | Audio.Recording | null;

/**
 * Starts a recording chunk on web or native.
 * @returns MediaRecorder (web) or Audio.Recording (native), or null if unsupported.
 */
export const startRecordingChunk = async (): Promise<UnifiedRecorder> => {
  try {
    // WEB
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      console.log('Web: Attempting to start recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Web: Microphone access granted');

      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.start();
      console.log('Web: Recording started (web)');
      return mediaRecorder;
    }

    // NATIVE
    if (Platform.OS !== 'web') {
      console.log('Native: Attempting to start recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      console.log('Native: Recording started on native device');
      return recording;
    }

    return null;
  } catch (error) {
    console.error('Error starting recording:', error);
    return null;
  }
};

/**
 * Stops a recording chunk on web or native and returns the audio URI (or null).
 * @param recorder MediaRecorder (web) or Audio.Recording (native), or null
 * @returns string (audio URL/URI) or null
 */
export const stopRecordingChunk = async (
  recorder: UnifiedRecorder
): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!recorder) {
      console.error('No active recording.');
      resolve(null);
      return;
    }

    // WEB
    if (Platform.OS === 'web' && recorder instanceof MediaRecorder) {
      console.log('Web: Stopping recording...');
      // We'll accumulate chunks here
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      recorder.onstop = () => {
        console.log('Web: Recording stopped');
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log('Web: Recording saved:', audioUrl);
        resolve(audioUrl);
      };

      recorder.stop();
    }
    // NATIVE
    else if (Platform.OS !== 'web' && recorder instanceof Audio.Recording) {
      console.log('Native: Stopping recording...');
      recorder
        .stopAndUnloadAsync()
        .then(() => {
          const uri = recorder.getURI();
          console.log('Native: Recording saved with URI:', uri);
          resolve(uri || null);
        })
        .catch((error) => {
          console.error('Error stopping native recording:', error);
          resolve(null);
        });
    }
    // Fallback if no conditions matched
    else {
      resolve(null);
    }
  });
};
