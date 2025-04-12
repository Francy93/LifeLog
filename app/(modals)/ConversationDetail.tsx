// app/(modals)/ConversationDetail.tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  FlatList,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import AudioPlayer from '../../components/AudioPlayer';
import { useSegmentContext } from '../../components/SegmentContext';
import type { Segment } from '../../hooks/useSegments';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Word {
  word: string;
  startTime: number;
  endTime: number;
}

export default function ConversationDetail() {
  const { timestampStart, durationMillis } = useLocalSearchParams<{
    timestampStart: string;
    durationMillis: string;
  }>();

  const initialTimestamp = Number(timestampStart);

  const [activeTimestamp, setActiveTimestamp] = useState(initialTimestamp);
  const [segmentAudioUri, setSegmentAudioUri] = useState('');
  const [segmentAudioBase64, setSegmentAudioBase64] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [segmentGroup, setSegmentGroup] = useState<(Segment & { words?: Word[] })[]>([]);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [scrollToCurrentSegmentPending, setScrollToCurrentSegmentPending] = useState(true);
  const hasScrolledRef = useRef(false);
  const userHasScrolledUpRef = useRef(false);
  const lastScrollYRef = useRef(0);

  const listRef = useRef<FlatList<any>>(null);
  const segmentRefs = useRef<(View | null)[]>([]);

  const {
    segments,
    getSegmentIndexByTimestamp,
    setActiveSegment,
  } = useSegmentContext();

  const currentSegmentIndex = getSegmentIndexByTimestamp(activeTimestamp);

  const sliceSegmentGroup = (start: number, end: number) => {
    setSegmentGroup(segments.slice(start, end));
    setRange({ start, end });
  };

  const navigateSegment = (offset: number) => {
    const index = currentSegmentIndex + offset;
    if (index >= 0 && index < segments.length) {
      setActiveTimestamp(segments[index].timestampStart);
      setScrollToCurrentSegmentPending(true);
    }
  };


  useEffect(() => {
    let start = Math.max(0, currentSegmentIndex - 1);
    let end = currentSegmentIndex + 1;
    let totalHeight = 0;
    const measureText = (text: string) => {
      const words = text.split(/\s+/);
      const lines = Math.ceil(words.length / 10);
      return lines * 22;
    };

    while (end < segments.length && totalHeight < SCREEN_HEIGHT * 0.75) {
      totalHeight += measureText(segments[end].transcription);
      end++;
    }

    setRange({ start, end });
    const group = segments.slice(start, end);
    setSegmentGroup(group);
    const selected = group.find(s => s.timestampStart === activeTimestamp);
    if (selected) {
      setActiveSegment(selected);
      if (selected.audioUri) setSegmentAudioUri(selected.audioUri);
      if (selected.audioBase64) setSegmentAudioBase64(selected.audioBase64);
    }
  }, [activeTimestamp]);



  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY < lastScrollYRef.current) {
      userHasScrolledUpRef.current = true;
    }
    lastScrollYRef.current = offsetY;

    const scrollHeight = event.nativeEvent.contentSize.height;
    const viewHeight = event.nativeEvent.layoutMeasurement.height;

    const currentStart = range.start;
    const currentEnd = range.end;

    if (offsetY + viewHeight >= scrollHeight - 40 && currentEnd < segments.length) {
      const newEnd = Math.min(segments.length, currentEnd + 3);
      sliceSegmentGroup(currentStart, newEnd);
    }

    if (
      offsetY <= 5 &&
      currentStart > 0 &&
      initialScrollDone &&
      hasScrolledRef.current &&
      userHasScrolledUpRef.current
    ) {
      const newStart = Math.max(0, currentStart - 3);
      sliceSegmentGroup(newStart, range.end);
    }
  };


  const renderItem = useCallback(function renderSegment({ item, index }: { item: Segment, index: number }) {
    const isCurrent = item.timestampStart === activeTimestamp;
    const textStyle = isCurrent ? styles.currentTranscript : styles.fadedTranscript;

    return (
      <View ref={(ref: View | null) => (segmentRefs.current[index] = ref)} style={{ marginBottom: 20 }}>
        {isCurrent ? (
          <Text style={styles.currentTranscript}>
            {(item.words || []).map((word: Word, i: number) => {
              const isHighlighted = currentTime >= word.endTime;
              return (
                <Text
                  key={i}

                  style={{
                    fontSize: 18,
                    lineHeight: 24,
                    color: isHighlighted ? 'blue' : 'black',
                    fontWeight: 'normal',
                  }}
                >
                  {word.word + ' '}
                </Text>
              );
            })}
          </Text>
        ) : (
          <Text style={textStyle}>{item.transcription}</Text>
        )}
        <Text style={{ fontSize: 12, color: '#aaa', textAlign: 'right' }}>
          {new Date(item.timestampStart).toLocaleTimeString()}
        </Text>
      </View>
    );
  }, [activeTimestamp, currentTime]);


  const currentInGroup = segmentGroup.findIndex(s => s.timestampStart === activeTimestamp);


  useEffect(() => {
    if (
      scrollToCurrentSegmentPending &&
      currentInGroup >= 0 &&
      currentInGroup < segmentGroup.length
    ) {
      setTimeout(() => {
        requestAnimationFrame(() => {
          const container = listRef.current;
          const target = segmentRefs.current[currentInGroup];
          if (!target || !container) return;
          if (Platform.OS === 'web') {
            (target as unknown as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else if ('measureLayout' in target) {
            (target as any).measureLayout(
              container.getScrollResponder(),
              (_x: number, y: number) => {
                container.scrollToOffset({ offset: Math.max(y - 64, 0), animated: true });
              },
              (error: unknown) => { console.error('Error measuring layout:', error); }
            );
          }
          setScrollToCurrentSegmentPending(false);
          setInitialScrollDone(true);
          hasScrolledRef.current = true;

        });
      }, 150);
    }
  }, [scrollToCurrentSegmentPending, currentInGroup, segmentGroup]);


  return (
    <View style={styles.container}>
      {currentInGroup !== -1 && segmentGroup.length > 0 && (<React.Fragment>
        <View style={styles.fadeContainer}>
          <LinearGradient colors={["#fff", "transparent"]} style={styles.topFade} /><FlatList
            ref={listRef}
            data={segmentGroup}

            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.transcriptionContainer}
            showsVerticalScrollIndicator={false}
          />
          <LinearGradient colors={["transparent", "#fff"]} style={styles.bottomFade} />
        </View>

        <AudioPlayer
          audioUri={segmentAudioUri}
          audioBase64={segmentAudioBase64}
          timestampStart={activeTimestamp}
          duration={Number(durationMillis)}
          onPlaybackUpdate={setCurrentTime}
          onNext={() => navigateSegment(1)}
          onPrevious={() => navigateSegment(-1)}
        />
      </React.Fragment>)}</View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fadeContainer: {
    flex: 3,
    position: 'relative',
  },
  transcriptionContainer: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: SCREEN_HEIGHT * 0.25,
  },
  currentTranscript: {
    fontSize: 18,
    lineHeight: 24,
    color: '#000',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  fadedTranscript: {
    fontSize: 16,
    lineHeight: 22,
    color: '#999',
    marginBottom: 10,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    height: 40,
    width: '100%',
    zIndex: 2,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    height: 40,
    width: '100%',
    zIndex: 2,
  },
});
