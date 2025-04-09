// services/transcriptionService.ts
import { Platform } from 'react-native';
import { getKey } from './google-api-key';

type TranscriptionResult = {
  text: string;
  words: { word: string; startTime: number; endTime: number }[];
  language: string;
};

export const transcribeAudioOffline = async (): Promise<TranscriptionResult | null> => {
  return null;
};

export const transcribeWithGoogleAPI = async (
  base64Audio: string
): Promise<TranscriptionResult | null> => {
  if (Platform.OS !== 'web') return null;

  try {
    const API_KEY = getKey();
    console.log('[Google Speech API] Using key:', API_KEY);

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'en-US',
            enableWordTimeOffsets: false,
          },
          audio: { content: base64Audio },
        }),
      }
    );

    const json = await response.json();
    console.log('[transcribeWithGoogleAPI] API result:', JSON.stringify(json, null, 2));

    if (!response.ok || !json?.results?.length) {
      console.warn('[transcribeWithGoogleAPI] No transcription results.');
      return null;
    }

    // 🔁 Merge all alternatives from all result segments
    const transcript = json.results
      .map((result: any) => result.alternatives?.[0]?.transcript ?? '')
      .join(' ')
      .trim();

    if (!transcript) return null;

    const words = transcript.split(' ').map((word: string, i: number) => ({
      word,
      startTime: i * 0.5,
      endTime: (i + 1) * 0.5,
    }));

    return { text: transcript, words, language: 'en' };
  } catch (err) {
    console.error('[Google Speech API] Error:', err);
    return null;
  }
};
