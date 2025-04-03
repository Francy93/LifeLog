import { Platform } from 'react-native';
import { Audio } from 'expo-av'; // Expo AV for native audio recording

// For Web: using the Web Audio API
export const startRecordingChunk = async (): Promise<MediaRecorder | Audio.Recording | null> => {
  try {
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      console.log('Web: Attempting to start recording...');
      
      // Web Handling using Web Audio API
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Web: Microphone access granted');

      const mediaRecorder = new MediaRecorder(stream);
      let chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('Web: Data available from recording');
        chunks.push(event.data);
      };

      mediaRecorder.start();
      console.log('Web: Recording started');

      return mediaRecorder; // Return MediaRecorder for web
    }

    // Native Handling using Expo AV
    if (Platform.OS !== 'web') {
      console.log('Native: Attempting to start recording...');

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      console.log('Native: Recording started on native device');
      
      return recording; // Return Expo Audio recording object for native platforms
    }

    return null; // Explicitly return null if no conditions match
  } catch (error) {
    console.error('Error starting recording:', error);
    return null; // Ensure that null is returned in case of error
  }
};

// For Web: Stop recording and return audio URL
export const stopRecordingChunk = async (
  recorder: MediaRecorder | Audio.Recording | null
): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!recorder) {
      console.error('No active recording.');
      resolve(null);
      return;
    }

    // Web Handling (using MediaRecorder)
    if (typeof window !== 'undefined' && recorder instanceof MediaRecorder) {
      console.log('Web: Stopping recording...');
      let chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        console.log('Web: Data available on stop');
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

    // Native Handling (using Expo AV)
    if (Platform.OS !== 'web' && recorder instanceof Audio.Recording) {
      console.log('Native: Stopping recording...');
      
      recorder.stopAndUnloadAsync().then(async () => {
        const uri = recorder.getURI();
        console.log('Native: Recording saved with URI:', uri);
        resolve(uri); // Return URI of recorded file
      }).catch(error => {
        console.error('Error stopping native recording:', error);
        resolve(null); // Ensure null is resolved in case of error
      });
    }

    resolve(null); // Fallback return if neither condition matches
  });
};
