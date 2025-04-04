// services/recordingService.ts
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export type UnifiedRecorder = MediaRecorder | Audio.Recording | null;

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
      console.log('Native: Requesting microphone permission...');
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.error('Microphone permission not granted');
        throw new Error('Missing audio recording permissions.');
      }

      console.log('Native: Permission granted. Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      console.log('Native: Recording started');
      return recording;
    }

    return null;
  } catch (error) {
    console.error('Error starting recording:', error);
    return null;
  }
};

/**
 * On web: returns blob URI and base64.
 * On native: returns file:// URI only.
 */
export const stopRecordingChunk = async (
  recorder: UnifiedRecorder
): Promise<{ uri: string; base64?: string } | null> => {
  return new Promise((resolve) => {
    if (!recorder) {
      console.error('No active recording.');
      resolve(null);
      return;
    }

    // WEB
    if (Platform.OS === 'web' && recorder instanceof MediaRecorder) {
      console.log('Web: Stopping recording...');
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      recorder.onstop = async () => {
        console.log('Web: Recording stopped');
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const blobUrl = URL.createObjectURL(audioBlob);

        // Convert Blob to Base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          console.log('[Web] Blob saved as Base64, URI:', blobUrl);
          resolve({ uri: blobUrl, base64 });
        };
        reader.onerror = (err) => {
          console.error('[Web] Error converting blob to base64:', err);
          resolve({ uri: blobUrl });
        };

        reader.readAsDataURL(audioBlob);
      };

      recorder.stop();
    }

    // NATIVE
    else if (Platform.OS !== 'web' && recorder instanceof Audio.Recording) {
      console.log('Native: Stopping recording...');
      recorder
        .stopAndUnloadAsync()
        .then(async () => {
          const originalUri = recorder.getURI();
          if (!originalUri) {
            console.error('Native: Failed to get recording URI');
            resolve(null);
            return;
          }

          const filename = `audio_${Date.now()}.m4a`;
          const newPath = FileSystem.documentDirectory + filename;

          try {
            await FileSystem.moveAsync({
              from: originalUri,
              to: newPath,
            });
            console.log('Native: File moved to:', newPath);
            resolve({ uri: newPath });
          } catch (moveError) {
            console.error('Native: Failed to move file:', moveError);
            resolve({ uri: originalUri });
          }
        })
        .catch((error) => {
          console.error('Error stopping native recording:', error);
          resolve(null);
        });
    }

    // Unknown platform
    else {
      resolve(null);
    }
  });
};
