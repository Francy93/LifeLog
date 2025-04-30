// app/(modals)/ConversationDetail.tsx
// -----------------------------------------------------------------------------
// Conversation Detail Screen
// Displays a scrollable transcript with an audio player.
// Provides smooth navigation between segments (buttons + per-row play icon)
// and keeps the current segment 100 px below the top to preview previous lines.
// -----------------------------------------------------------------------------
import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Platform,
  UIManager,
  LayoutAnimation,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  Pressable,
  View,
  Text,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";

import AudioPlayer from "../../components/AudioPlayer";
import { useSegmentContext } from "../../components/SegmentContext";
import type { Segment } from "../../hooks/useSegments";

// Enable layout animation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  // @ts-ignore – RN typings
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// -----------------------------------------------------------------------------
// Constants & types
// -----------------------------------------------------------------------------
const SCREEN_HEIGHT = Dimensions.get("window").height;
const PREVIEW_OFFSET = 100; // px – space shown above the current segment

interface Word {
  word: string;
  startTime: number;
  endTime: number;
}

// Helper – quick rough text height estimate (10 words ≈ one 22 px line)
const estimateHeight = (t: string) =>
  Math.ceil(t.split(/\s+/).length / 10) * 22;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function ConversationDetail() {
  // ------------------------------ route params ------------------------------
  const { timestampStart, durationMillis } = useLocalSearchParams<{
    timestampStart: string;
    durationMillis: string;
  }>();
  const initialTimestamp = Number(timestampStart);

  // ------------------------------ state -------------------------------------
  const [activeTimestamp, setActiveTimestamp] = useState(initialTimestamp);
  const [segmentAudioUri, setSegmentAudioUri] = useState("");
  const [segmentAudioBase64, setSegmentAudioBase64] = useState("");
  const [currentTime, setCurrentTime] = useState(0); // progress for highlight
  // sliding window of segments displayed
  const [segmentGroup, setSegmentGroup] = useState<
    (Segment & { words?: Word[] })[]
  >([]);
  const [range, setRange] = useState({ start: 0, end: 0 });
  // flags
  const [scrollPending, setScrollPending] = useState(true); // auto-scroll in flight
  const [styleReady, setStyleReady] = useState(true); // show active style?

  // ------------------------------ refs --------------------------------------
  const hasScrolledRef = useRef(false);
  const listRef = useRef<FlatList<any>>(null);
  const segmentRefs = useRef<(View | null)[]>([]);

  // ------------------------------ context -----------------------------------
  const { segments, getSegmentIndexByTimestamp, setActiveSegment } =
    useSegmentContext();
  const currentIndex = getSegmentIndexByTimestamp(activeTimestamp);

  // Compute the active segment object
  const currentSegment = segmentGroup.find(
    (s) => s.timestampStart === activeTimestamp
  );

  // -------------------------------------------------------------------------
  // UTIL – centralised selection logic (nav buttons + play icons)
  // -------------------------------------------------------------------------
  const selectSegment = (timestamp: number) => {
    setCurrentTime(0);
    setStyleReady(false);
    setActiveTimestamp(timestamp);
    setScrollPending(true);
  };

  // -------------------------------------------------------------------------
  // Build / update the sliding window whenever active segment changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    let start = Math.max(0, currentIndex - 1);
    let end = currentIndex + 1;
    let total = 0;

    while (end < segments.length && total < SCREEN_HEIGHT * 0.75) {
      total += estimateHeight(segments[end].transcription);
      end++;
    }

    setRange({ start, end });
    const window = segments.slice(start, end);
    setSegmentGroup(window);

    const selected = window.find((s) => s.timestampStart === activeTimestamp);
    if (selected) {
      setActiveSegment(selected);
      setSegmentAudioUri(selected.audioUri);
      setSegmentAudioBase64(selected.audioBase64);
    }
  }, [activeTimestamp]);

  // -------------------------------------------------------------------------
  // Scroll listener – disabled while auto-scroll is taking place
  // -------------------------------------------------------------------------
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (scrollPending) return;

    const { y: offsetY } = e.nativeEvent.contentOffset;
    const { height: viewHeight } = e.nativeEvent.layoutMeasurement;
    const contentHeight = e.nativeEvent.contentSize.height;

    // ---------- append when near bottom ----------
    if (
      offsetY + viewHeight >= contentHeight - 40 &&
      range.end < segments.length
    ) {
      const newEnd = Math.min(segments.length, range.end + 3);
      setRange((r) => ({ ...r, end: newEnd }));
      setSegmentGroup(segments.slice(range.start, newEnd));
    }

    // ---------- prepend when user scrolls to top ----------
    if (offsetY <= 5 && hasScrolledRef.current && range.start > 0) {
      const newStart = Math.max(0, range.start - 3);
      setRange((r) => ({ ...r, start: newStart }));
      setSegmentGroup(segments.slice(newStart, range.end));
    }
  };

  // -------------------------------------------------------------------------
  // Navigation buttons (prev / next)
  // -------------------------------------------------------------------------
  const navigateSegment = (delta: number) => {
    const idx = currentIndex + delta;
    if (idx >= 0 && idx < segments.length) {
      selectSegment(segments[idx].timestampStart);
    }
  };

  // -------------------------------------------------------------------------
  // Row renderer
  // -------------------------------------------------------------------------
  const renderItem = useCallback(
    ({ item, index }: { item: Segment; index: number }) => {
      const isCurrent = item.timestampStart === activeTimestamp;
      const currentRow = segmentGroup.findIndex(
        (s) => s.timestampStart === activeTimestamp
      );
      // preview offset only on web as CSS prop
      const containerStyle: ViewStyle =
        Platform.OS === "web" && index === currentRow
          ? ({ scrollMarginTop: PREVIEW_OFFSET } as any)
          : {};

      const baseStyle = isCurrent ? styles.currentBase : styles.faded;
      const stateStyle = isCurrent
        ? styleReady
          ? styles.currentActive
          : styles.currentInactive
        : undefined;

      return (
        <View
          ref={(r) => (segmentRefs.current[index] = r)}
          style={[styles.segmentRow, containerStyle]}
        >
          {/* text block */}
          {isCurrent && item.words && item.words.length > 0 ? (
            <Text style={[baseStyle, stateStyle] as StyleProp<TextStyle>}>
              {item.words.map((w, i) => (
                <Text
                  key={i}
                  style={{
                    color:
                      styleReady && currentTime >= w.endTime
                        ? "blue"
                        : styleReady
                        ? "#000"
                        : "#999",
                  }}
                >
                  {w.word + " "}
                </Text>
              ))}
            </Text>
          ) : (
            <Text
              style={[baseStyle, isCurrent ? stateStyle : undefined] as StyleProp<TextStyle>}
            >
              {item.transcription}
            </Text>
          )}

          {/* timestamp + play */}
          <View style={styles.timestampRow}>
            <Pressable onPress={() => selectSegment(item.timestampStart)}>
              <Ionicons
                name="play"
                size={14}
                color="#555"
                style={styles.playIcon}
              />
            </Pressable>
            <Text style={styles.timestamp}>
              {new Date(item.timestampStart).toLocaleTimeString()}
            </Text>
          </View>
        </View>
      );
    },
    [activeTimestamp, currentTime, styleReady, segmentGroup]
  );

  // -------------------------------------------------------------------------
  // Auto-scroll to current segment
  // -------------------------------------------------------------------------
  const currentRowIndex = segmentGroup.findIndex(
    (s) => s.timestampStart === activeTimestamp
  );

  useEffect(() => {
    if (!scrollPending || currentRowIndex < 0) return;
    // delay until FlatList renders
    setTimeout(() => {
      const target = segmentRefs.current[currentRowIndex];
      const container: any =
        (listRef.current as any)?.getScrollableNode?.() || listRef.current;
      if (!target || !container) return;

      if (Platform.OS === "web") {
        (target as any).scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      } else {
        target.measureLayout(
          container.getScrollResponder(),
          (_x, y) =>
            container.scrollToOffset({
              offset: Math.max(y - PREVIEW_OFFSET, 0),
              animated: true,
            }),
          () => {}
        );
      }
      // after scroll finishes, enable highlight & re‑allow scroll listener
      setTimeout(() => {
        LayoutAnimation.configureNext(
          LayoutAnimation.Presets.easeInEaseOut
        );
        setCurrentTime(0);
        setStyleReady(true);
        setScrollPending(false);
        hasScrolledRef.current = true;
      }, 150);
    }, 0);
  }, [scrollPending, currentRowIndex]);

  // -------------------------------------------------------------------------
  // Playback progress – ignore updates during auto‑scroll
  // -------------------------------------------------------------------------
  const handlePlaybackUpdate = useCallback(
    (t: number) => {
      if (!scrollPending) setCurrentTime(t);
    },
    [scrollPending]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {currentRowIndex >= 0 && (
        <>
          <View style={styles.fadeContainer}>
            <LinearGradient
              colors={["#fff", "transparent"]}
              style={styles.topFade}
            />
            <FlatList
              ref={listRef}
              data={segmentGroup}
              keyExtractor={(s) => s.id}
              renderItem={renderItem}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.transcriptionContainer}
              showsVerticalScrollIndicator={false}
            />
            <LinearGradient
              colors={["transparent", "#fff"]}
              style={styles.bottomFade}
            />
          </View>

          <AudioPlayer
            audioUri={segmentAudioUri}
            audioBase64={segmentAudioBase64}
            timestampStart={activeTimestamp}
            duration={currentSegment?.durationMillis ?? Number(durationMillis)}
            onPlaybackUpdate={handlePlaybackUpdate}
            onNext={() => navigateSegment(1)}
            onPrevious={() => navigateSegment(-1)}
          />
        </>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  fadeContainer: {
    flex: 3,
    position: "relative",
  },
  transcriptionContainer: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: SCREEN_HEIGHT * 0.25,
  },
  topFade: {
    position: "absolute",
    top: 0,
    height: 40,
    width: "100%",
    zIndex: 2,
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    height: 40,
    width: "100%",
    zIndex: 2,
  },
  segmentRow: {
    marginBottom: 20,
  },
  currentBase: {
    fontSize: 18,
    lineHeight: 24,
    flexWrap: "wrap",
  },
  faded: {
    fontSize: 16,
    lineHeight: 22,
    color: "#999",
  },
  currentActive: {
    color: "#000",
  },
  currentInactive: {
    color: "#999",
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: "#aaa",
  },
  playIcon: {
    marginRight: 4,
  },
});
