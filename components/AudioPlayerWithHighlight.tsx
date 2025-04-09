import React, { useEffect, useState } from 'react';
import { Audio } from 'expo-av';
import { Text, View, Platform, Pressable } from 'react-native';

interface Word {
  word: string;
  startTime: number;
  endTime: number;
}

interface Props {
  uri: string;
  words: Word[];
  audioBase64?: string;
}

export default function AudioPlayerWithHighlight({ uri, words, audioBase64 }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [position, setPosition] = useState(0);
  const [hoveredWord, setHoveredWord] = useState<Word | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const load = async () => {
      let sourceUri = uri;
      if (Platform.OS === 'web' && audioBase64) {
        sourceUri = `data:audio/mp4;base64,${audioBase64}`;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: sourceUri },
        { shouldPlay: false }
      );

      setSound(sound);

      interval = setInterval(async () => {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          setPosition(status.positionMillis / 1000);
        }
      }, 250);
    };

    load();

    return () => {
      clearInterval(interval);
      sound?.unloadAsync();
    };
  }, []);

  return (
    <View>
      <Text style={{ flexWrap: 'wrap', lineHeight: 28 }}>
        {words.map((w, i) => (
          <Pressable
            key={i}
            onPressIn={() => setHoveredWord(w)}
            onPressOut={() => setHoveredWord(null)}
          >
            <Text
              style={{
                color: position >= w.startTime && position <= w.endTime ? '#007AFF' : 'black',
              }}
            >
              {w.word + ' '}
            </Text>
          </Pressable>
        ))}
      </Text>
      {hoveredWord && (
        <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          {`[${hoveredWord.startTime.toFixed(1)}s - ${hoveredWord.endTime.toFixed(1)}s]`}
        </Text>
      )}
    </View>
  );
}
