// app/(modals)/ConversationDetail.tsx
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AudioPlayer from '../../components/AudioPlayer';

interface Word {
  word: string;
  startTime: number;
  endTime: number;
}

export default function ConversationDetail() {
  const [segmentAudioUri, setSegmentAudioUri] = useState<string>('');
  const [segmentAudioBase64, setSegmentAudioBase64] = useState<string>('');
  const scrollViewRef = useRef<ScrollView>(null);
  const wordRefs = useRef<(number | null)[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  console.log('[ConversationDetail] CurrentTime state:', currentTime);

  const {
    transcription,
    timestampStart,
    timestampEnd,
    durationMillis,
  } = useLocalSearchParams<{
    transcription: string;
    timestampStart: string;
    timestampEnd: string;
    durationMillis: string;
  }>();

  

  const [wordData, setWordData] = useState<Word[]>([]);

  const scrollToActiveWord = (index: number) => {
    const y = wordRefs.current[index];
    if (typeof y === 'number') {
      scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
    }
  };

  useEffect(() => {
    const activeIndex = wordData.findIndex((word) => currentTime >= word.endTime);
    if (activeIndex !== -1) {
      console.log('[Highlighting] Up to word index', activeIndex);
      scrollToActiveWord(activeIndex);
    }
  }, [currentTime]);

  useEffect(() => {
    const fetchWordsFromStorage = async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const entries = await AsyncStorage.multiGet(allKeys);
        const segmentsEntry = entries.find(([key]) => key === 'segments');
        if (segmentsEntry) {
          const parsed = JSON.parse(segmentsEntry[1] || '[]');
          const index = parsed.findIndex((s: any) => s.timestampStart === Number(timestampStart));
          if (index !== -1) {
            if (parsed[index].words) {
              console.log('[Words for current segment]:', parsed[index].words);
              setWordData(parsed[index].words);
            }
            if (parsed[index].audioUri) {
              setSegmentAudioUri(parsed[index].audioUri);
            }
            if (parsed[index].audioBase64) {
              setSegmentAudioBase64(parsed[index].audioBase64);
            }
          } else {
            console.warn('Segment found but no words field exists.');
          }
        } else {
          console.warn('No "segments" key found in AsyncStorage.');
        }
      } catch (err) {
        console.error('[Error fetching segment words from AsyncStorage]', err);
      }
    };

    fetchWordsFromStorage();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollViewRef} style={styles.transcriptionContainer}>
        <View style={styles.transcriptionRow}>
          {wordData.length > 0
            ? wordData.map((word, index) => {
                const isHighlighted = currentTime >= word.endTime;
                console.log(
                  `[Word ${index}] "${word.word}" | currentTime: ${currentTime.toFixed(2)} | endTime: ${word.endTime} | ${
                    isHighlighted ? '✔️ HIGHLIGHT' : '---'
                  }`
                );
                return (
                  <Text
                    key={index}
                    onLayout={(e) => {
                      wordRefs.current[index] = e.nativeEvent.layout.y;
                    }}
                    style={{
                      color: isHighlighted ? 'blue' : 'black',
                      fontWeight: isHighlighted ? 'bold' : 'normal',
                      fontSize: 18,
                      lineHeight: 24,
                    }}
                  >
                    {word.word + ' '}
                  </Text>
                );
              })
            : <Text style={styles.transcription}>{transcription}</Text>}
        </View>

        {durationMillis && (
          <Text style={styles.durationInfo}>
            Duration: {(Number(durationMillis) / 1000).toFixed(1)}s
          </Text>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.loadMoreButton}
        onPress={() => Alert.alert('Carica altro...', 'Funzionalità in arrivo')}
      >
        <Text style={styles.loadMoreText}>⬇️ Carica altro...</Text>
      </TouchableOpacity>

      <AudioPlayer
        audioUri={segmentAudioUri}
        audioBase64={segmentAudioBase64}
        timestampStart={Number(timestampStart)}
        duration={Number(durationMillis)}
        onPlaybackUpdate={setCurrentTime}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  transcriptionContainer: {
    flex: 3,
    padding: 20,
  },
  transcriptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flex: 1,
  },
  transcription: {
    fontSize: 18,
    lineHeight: 24,
    flexWrap: 'wrap',
  },
  durationInfo: {
    fontSize: 14,
    color: '#555',
    marginTop: 10,
  },
  loadMoreButton: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#eee',
  },
  loadMoreText: {
    fontSize: 16,
    color: '#333',
  },
});
