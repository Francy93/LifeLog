// app/(tabs)/TimeLine.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  DeviceEventEmitter,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

interface Segment {
  id: string;
  timestampStart: number;
  timestampEnd: number;
  durationMillis: number;
  transcription: string;
  audioUri: string;
  audioBase64: string;
}

export default function Timeline() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<'from' | 'to' | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Segment | null>(null);

  const router = useRouter();

  // ------------------------------------------------------------------
  // Load segments from AsyncStorage on mount
  // and set up listener for updates
  // ------------------------------------------------------------------
  const loadSegments = async () => {
    try {
      const stored = await AsyncStorage.getItem('segments');
      stored ? setSegments(JSON.parse(stored)) : setSegments([]);
    } catch (e) {
      console.error('[Timeline] load', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSegments();
      const sub = DeviceEventEmitter.addListener('segmentsUpdated', loadSegments);
      return () => sub.remove();
    }, []),
  );

  // ------------------------------------------------------------------
  // Filter + sort helpers
  // ------------------------------------------------------------------
  const inRange = (seg: Segment) => {
    if (fromDate && seg.timestampEnd < fromDate.setHours(0, 0, 0, 0)) return false;
    if (toDate && seg.timestampEnd > toDate.setHours(23, 59, 59, 999)) return false;
    return true;
  };

  let displayed = segments;
  if (searchQuery.trim()) {
    const term = searchQuery.toLowerCase();
    displayed = displayed.filter((s) => s.transcription.toLowerCase().includes(term));
  }
  displayed = displayed.filter(inRange);
  displayed.sort((a, b) => (sortAsc ? a.timestampEnd - b.timestampEnd : b.timestampEnd - a.timestampEnd));

  // ------------------------------------------------------------------
  // Delete flow
  // ------------------------------------------------------------------
  const confirmDeleteSegment = (s: Segment) => {
    setPendingDelete(s);
    setModalVisible(true);
  };
  const performDelete = async () => {
    if (!pendingDelete) return;
    const { id, audioUri } = pendingDelete;
    try {
      if (audioUri.startsWith('file://')) {
        const info = await FileSystem.getInfoAsync(audioUri);
        if (info.exists) await FileSystem.deleteAsync(audioUri, { idempotent: true });
      }
      const stored = await AsyncStorage.getItem('segments');
      if (stored) {
        const all: Segment[] = JSON.parse(stored);
        const updated = all.filter((s) => s.id !== id);
        await AsyncStorage.setItem('segments', JSON.stringify(updated));
        setSegments(updated);
        DeviceEventEmitter.emit('segmentsUpdated');
      }
    } catch (e) {
      console.error('[Delete]', e);
    }
    setModalVisible(false);
    setPendingDelete(null);
  };

  // ------------------------------------------------------------------
  // Row renderer for the FlatList
  // ------------------------------------------------------------------
  const Row = ({ item }: { item: Segment }) => (
    <View style={styles.item}>
      <TouchableOpacity style={styles.content} onPress={() => router.push({ pathname: '/ConversationDetail', params: { transcription: item.transcription, timestampStart: String(item.timestampStart), timestampEnd: String(item.timestampEnd), durationMillis: String(item.durationMillis) } })}>
        <Text style={styles.timestamp}>
          {new Date(item.timestampEnd).toLocaleDateString()} {new Date(item.timestampEnd).toLocaleTimeString()} ({Math.round(item.durationMillis / 1000)}s)
        </Text>
        <Text style={styles.preview}>{item.transcription.slice(0, 80)}...</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDeleteSegment(item)}>
        <Ionicons name="trash-outline" size={20} color="red" />
      </TouchableOpacity>
    </View>
  );

  // ------------------------------------------------------------------
  // JSX rendering and layout
  // ------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Search */}
      <TextInput style={styles.searchBar} placeholder="Search transcriptions..." value={searchQuery} onChangeText={setSearchQuery} />

      {/* Filter & sort */}
      <View style={styles.filterRow}>
        {/* FROM control */}
        {Platform.select({
          web: (
            <input
              type="date"
              style={styles.dateInputWeb as any}
              value={fromDate ? `${fromDate.getFullYear()}-${(fromDate.getMonth()+1).toString().padStart(2,'0')}-${fromDate.getDate().toString().padStart(2,'0')}` : ''}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                setFromDate(new Date(y, m - 1, d));
              }}
            />
          ),
          default: (
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker('from')}>
              <Ionicons name="calendar" size={14} />
              <Text style={styles.dateText}>{fromDate ? fromDate.toLocaleDateString() : 'From'}</Text>
            </TouchableOpacity>
          ),
        })}

        {/* TO control */}
        {Platform.select({
          web: (
            <input
              type="date"
              style={styles.dateInputWeb as any}
              value={toDate ? `${toDate.getFullYear()}-${(toDate.getMonth()+1).toString().padStart(2,'0')}-${toDate.getDate().toString().padStart(2,'0')}` : ''}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                setToDate(new Date(y, m - 1, d));
              }}
            />
          ),
          default: (
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker('to')}>
              <Ionicons name="calendar" size={14} />
              <Text style={styles.dateText}>{toDate ? toDate.toLocaleDateString() : 'To'}</Text>
            </TouchableOpacity>
          ),
        })}

        {/* Sort */}
        <TouchableOpacity style={styles.sortButton} onPress={() => setSortAsc((p) => !p)}>
          <Ionicons name={sortAsc ? 'arrow-up' : 'arrow-down'} size={20} />
        </TouchableOpacity>
      </View>

      {/* Native picker (mobile only) */}
      {showPicker && Platform.OS !== 'web' && (
        <DateTimePicker mode="date" value={(showPicker === 'from' ? fromDate : toDate) ?? new Date()} onChange={(_, d) => { setShowPicker(null); if (d) showPicker === 'from' ? setFromDate(d) : setToDate(d); }} />
      )}

      {/* List */}
      {displayed.length === 0 ? (
        <Text style={styles.emptyMessage}>No transcript available</Text>
      ) : (
        <View style={styles.listWrapper}>
          <FlatList data={displayed} keyExtractor={(i) => i.id} renderItem={Row} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" />
          <LinearGradient pointerEvents="none" colors={["#fff", "transparent"]} style={styles.topFade} />
          <LinearGradient pointerEvents="none" colors={["transparent", "#fff"]} style={styles.bottomFade} />
        </View>
      )}

      {/* Delete modal (unchanged) */}
      <Modal transparent animationType="fade" visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Confirm deletion</Text>
          <Text style={styles.modalMessage}>Do you want to delete this segment?</Text>

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

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------
const FADE_HEIGHT = 25;

const styles = StyleSheet.create({
  /* ---------- top-level layout ---------- */
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
  },

  /* ---------- search bar ---------- */
  searchBar: {
    height: 45,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },

  /* ---------- filter row ---------- */
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },

  /* date buttons (native platforms) */
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 6,
    backgroundColor: '#fafafa',
  },
  dateText: {
    marginLeft: 4,
    fontSize: 14,
  },

  /* HTML <input type="date"> for web */
  dateInputWeb: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginRight: 6,
    fontSize: 14,
  },

  /* sort toggle */
  sortButton: {
    marginLeft: 'auto',
    padding: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },

  /* ---------- list & fades ---------- */
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },

  /* ---------- empty-state ---------- */
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    color: 'gray',
  },

  /* ---------- list row ---------- */
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  content: {
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: 'gray',
  },
  preview: {
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    marginLeft: 10,
    padding: 4,
  },

  /* ---------- delete modal ---------- */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  confirmButton: {
    backgroundColor: '#ff3b30',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
