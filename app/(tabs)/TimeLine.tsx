// app/(tabs)/TimeLine.tsx
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  DeviceEventEmitter,
  Platform,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";

interface Segment {
  id: string;
  timestampStart: number;
  timestampEnd: number;
  durationMillis: number;
  transcription: string;
  audioUri: string;
  audioBase64: string;
}

// ----------------------------------------------------------------------------
//  Timeline component
// ----------------------------------------------------------------------------
export default function Timeline() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<"from" | "to" | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Segment | null>(null);
  const router = useRouter();

  // Scroll fade states
  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // ----------------------------------------------------------------------------
  //  Load segments from AsyncStorage
  // ----------------------------------------------------------------------------
  const loadSegments = async () => {
    try {
      const stored = await AsyncStorage.getItem("segments");
      setSegments(stored ? JSON.parse(stored) : []);
    } catch (e) {
      console.error("[Timeline] load", e);
    }
  };

  // ----------------------------------------------------------------------------
  //  Effect to load segments when the component mounts and on focus
  // ----------------------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      loadSegments();
      const sub = DeviceEventEmitter.addListener(
        "segmentsUpdated",
        loadSegments
      );
      return () => sub.remove();
    }, [])
  );

  // ----------------------------------------------------------------------------
  //  Filter and sort segments based on search query and date range
  // ----------------------------------------------------------------------------
  const inRange = (s: Segment) => {
    if (fromDate && s.timestampEnd < fromDate.setHours(0, 0, 0, 0))
      return false;
    if (toDate && s.timestampEnd > toDate.setHours(23, 59, 59, 999))
      return false;
    return true;
  };

  // Filter segments based on search query and date range
  let displayed = segments;
  if (searchQuery.trim()) {
    const term = searchQuery.toLowerCase();
    displayed = displayed.filter((s) =>
      s.transcription.toLowerCase().includes(term)
    );
  }
  displayed = displayed.filter(inRange);
  displayed.sort((a, b) =>
    sortAsc ? a.timestampEnd - b.timestampEnd : b.timestampEnd - a.timestampEnd
  );

  // ----------------------------------------------------------------------------
  //  Group segments by date and format the display
  // ----------------------------------------------------------------------------
  const groupSegments = (items: Segment[]) => {
    const groups: { title: string; data: Segment[] }[] = [];
    let section: { title: string; data: Segment[] } | null = null;
    items.forEach((s) => {
      const diff = section
        ? Math.abs(
            s.timestampEnd - section.data[section.data.length - 1].timestampEnd
          )
        : 0;
      if (!section || diff >= 5 * 60 * 1000) {
        section = {
          title: new Date(s.timestampEnd).toLocaleDateString(),
          data: [s],
        };
        groups.push(section);
      } else {
        section.data.push(s);
      }
    });
    return groups.map((sec) => {
      const oldest = sec.data[sec.data.length - 1];
      const dateStr = sec.title;
      const timeStr = new Date(oldest.timestampEnd).toLocaleTimeString();
      return { title: `${dateStr} ${timeStr}`, data: sec.data };
    });
  };

  // Group segments by date
  const sections = groupSegments(displayed);

  // ----------------------------------------------------------------------------
  //  Delete segment confirmation and deletion
  // ----------------------------------------------------------------------------
  const confirmDelete = (s: Segment) => {
    setPendingDelete(s);
    setModalVisible(true);
  };
  const performDelete = async () => {
    if (!pendingDelete) return;
    const { id, audioUri } = pendingDelete;
    try {
      if (audioUri.startsWith("file://")) {
        const info = await FileSystem.getInfoAsync(audioUri);
        if (info.exists)
          await FileSystem.deleteAsync(audioUri, { idempotent: true });
      }
      const stored = await AsyncStorage.getItem("segments");
      const all: Segment[] = stored ? JSON.parse(stored) : [];
      const updated = all.filter((s) => s.id !== id);
      await AsyncStorage.setItem("segments", JSON.stringify(updated));
      setSegments(updated);
      DeviceEventEmitter.emit("segmentsUpdated");
    } catch (e) {
      console.error("[Delete]", e);
    }
    setModalVisible(false);
    setPendingDelete(null);
  };

  // Scroll event handler
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(e.nativeEvent.contentOffset.y);
  };

  // ----------------------------------------------------------------------------
  //  Date picker for mobile platforms
  // ----------------------------------------------------------------------------
  const WebDateInput = ({
    date,
    setDate,
  }: {
    date: Date | null;
    setDate: (d: Date) => void;
  }) => {
    const formatted = date
      ? `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
      : '';
    return (
      <input
        type="date"
        style={styles.dateInputWeb as any}
        value={formatted}
        onChange={(e) => {
          const [y, m, d] = e.target.value.split('-').map(Number);
          setDate(new Date(y, m - 1, d));
        }}
      />
    );
  };  

  // ----------------------------------------------------------------------------
  //  Render the component
  // ----------------------------------------------------------------------------
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchBar}
        placeholder="Search transcriptions..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <View style={styles.filterRow}>
        {Platform.OS === 'web' && <WebDateInput date={fromDate} setDate={setFromDate} />}
        {Platform.OS === 'web' && <WebDateInput date={toDate} setDate={setToDate} />}
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setSortAsc((p) => !p)}
        >
          <Ionicons name={sortAsc ? "arrow-up" : "arrow-down"} size={20} />
        </TouchableOpacity>
      </View>
      {showPicker && Platform.OS !== "web" && (
        <DateTimePicker
          mode="date"
          value={(showPicker === "from" ? fromDate : toDate) ?? new Date()}
          onChange={(_, d) => {
            setShowPicker(null);
            if (d) showPicker === "from" ? setFromDate(d) : setToDate(d);
          }}
        />
      )}

      {sections.length === 0 ? (
        <Text style={styles.emptyMessage}>No transcript available</Text>
      ) : (
        <View
          style={styles.listWrapper}
          onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
        >
          <ScrollView
            contentContainerStyle={styles.listContent}
            onContentSizeChange={(_, h) => setContentHeight(h)}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
          >
            {sections.map((section) => (
              <View key={section.title} style={styles.groupContainer}>
                <View style={styles.bullet} />
                <View style={styles.verticalLineGroup} />
                <View style={styles.sectionContent}>
                  <Text style={styles.headerText}>{section.title}</Text>
                  {section.data.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.item}
                      onPress={() =>
                        router.push({
                          pathname: "/ConversationDetail",
                          params: {
                            transcription: item.transcription,
                            timestampStart: String(item.timestampStart),
                            timestampEnd: String(item.timestampEnd),
                            durationMillis: String(item.durationMillis),
                          },
                        })
                      }
                    >
                      <View style={styles.content}>
                        <View style={styles.metaRow}>
                          <Text style={styles.timestamp}>
                            Time:{" "}
                            {new Date(item.timestampEnd).toLocaleTimeString()}
                          </Text>
                          <Text style={styles.duration}>
                            Duration: {Math.round(item.durationMillis / 1000)}s
                          </Text>
                        </View>
                        <Text style={styles.preview}>
                          {item.transcription.slice(0, 80)}...
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => confirmDelete(item)}
                      >
                        <Ionicons name="trash-outline" size={20} color="red" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          {/* Fade indicators */}
          {scrollY > 0 && (
            <LinearGradient
              colors={["#f0f0f0", "transparent"]}
              style={styles.topFade}
            />
          )}
          {scrollY + containerHeight < contentHeight && (
            <LinearGradient
              colors={["transparent", "#f0f0f0"]}
              style={styles.bottomFade}
            />
          )}
        </View>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Confirm deletion</Text>
            <Text style={styles.modalMessage}>
              Do you want to delete this segment?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setPendingDelete(null);
                }}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={performDelete}
                style={[styles.modalButton, styles.confirmButton]}
              >
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ----------------------------------------------------------------------------
//  Styles
// ----------------------------------------------------------------------------
const FADE_HEIGHT = 25;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f0", padding: 10 },
  searchBar: {
    height: 45,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  filterRow: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  dateInputWeb: {
    padding: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginRight: 6,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  sortButton: {
    marginLeft: "auto",
    padding: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  listWrapper: { flex: 1, position: "relative" },
  listContent: { paddingRight: 16 },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
    color: "gray",
  },
  groupContainer: { marginBottom: 16, position: "relative" },
  bullet: {
    position: "absolute",
    top: 4,
    left: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#888",
    backgroundColor: "#f0f0f0",
    zIndex: 1,
  },
  verticalLineGroup: {
    position: "absolute",
    top: 12,
    bottom: 0,
    left: 15,
    width: 2,
    backgroundColor: "#888",
  },
  sectionContent: { marginLeft: 32 },
  headerText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginVertical: 4,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 6,
    position: "relative",
  },
  content: { flex: 1 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  timestamp: { fontSize: 12, color: "gray" },
  duration: { fontSize: 12, color: "gray" },
  preview: { fontSize: 14, fontWeight: "500" },
  deleteButton: { marginLeft: 10, padding: 4 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "80%",
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  modalMessage: { fontSize: 16, marginBottom: 20, textAlign: "center" },
  modalButtons: { flexDirection: "row", justifyContent: "space-around" },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  cancelButton: { backgroundColor: "#ccc" },
  confirmButton: { backgroundColor: "#ff3b30" },
  modalButtonText: { color: "#fff", fontWeight: "bold" },
});
