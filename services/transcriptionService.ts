// services/transcriptionService.ts
import axios from 'axios';

export const transcribeAudio = async (uri: string): Promise<string> => {
  try {
    const response = await axios.post(
      'https://speech.googleapis.com/v1/speech:recognize',
      {
        audio: { uri },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US',
        },
      },
      {
        headers: {
          'Authorization': `Bearer YOUR_ACCESS_TOKEN`, // Sostituisci con il token valido
          'Content-Type': 'application/json',
        },
      }
    );
    const transcript = response.data.results
      .map((result: { alternatives: { transcript: string }[] }) => result.alternatives[0].transcript)
      .join(' ');
    return transcript;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return '';
  }
};
