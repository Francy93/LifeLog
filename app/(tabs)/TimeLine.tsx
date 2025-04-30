// app/(tabs)/TimeLine.tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTimeline, TimelineSection } from '../../hooks/useTimeline';

const FADE_HEIGHT = 25;

// Utility to format dates for web <input type="date">
const formatDateForInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Extracted date‐picker component (hoisted)
const DatePickerField: React.FC<{
  label: string;
  date: Date | null;
  onPress: () => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, date, onPress, onChange }) => (
  <View style={styles.pickerGroup}>
    <Text style={styles.pickerLabel}>{label}</Text>
    {Platform.OS === 'web' ? (
      <input
        type="date"
        value={date ? formatDateForInput(date) : ''}
        onChange={(e) => {
          if (!onChange) return;
          const v = e.target.value;
          if (!v) return onChange(e);
          const [yyyy, mm, dd] = v.split('-').map(Number);
          onChange({
            ...e,
            target: { ...e.target, value: new Date(yyyy, mm - 1, dd).toISOString() },
          } as any);
        }}
        style={styles.webDate as any}
      />
    ) : (
      <TouchableOpacity style={styles.pickerBtn} onPress={onPress}>
        <Text>{date ? date.toDateString() : ''}</Text>
      </TouchableOpacity>
    )}
  </View>
);

export default function TimeLine() {
  const router = useRouter();
  const {
    sections,
    favoriteList,

    /* filters */
    searchQuery,
    setSearchQuery,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    sortAsc,
    setSortAsc,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showFilterModal,
    openFilterModal,
    closeFilterModal,
    activeFilters,
    removeFilter,

    /* selection */
    isSelecting,
    selectedIds,
    longPressSelect,
    toggleSelect,
    selectAll,
    clearSelection,
    deselectAll,

    /* fav / delete */
    toggleFavorite,
    showDeleteModal,
    confirmDelete,
    cancelDelete,
    performDelete,
  } = useTimeline();

  /* local state */
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [pickerMode, setPickerMode] = useState<'from' | 'to' | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setScrollY(e.nativeEvent.contentOffset.y);

  /* memoized totals */
  const totalCount = useMemo(
    () => sections.reduce((sum, sec) => sum + sec.data.length, 0),
    [sections]
  );

  /* handlers */
  const toggleSearch = useCallback(() => setSearchExpanded(p => !p), []);
  const toggleAll = useCallback(
    () =>
      selectedIds.length === totalCount ? deselectAll() : selectAll(),
    [selectedIds.length, totalCount, deselectAll, selectAll]
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.navBar}>
        <TouchableOpacity>
          <Ionicons name="menu" size={24} />
        </TouchableOpacity>

        {searchExpanded ? (
          <TextInput
            style={styles.searchInput}
            placeholder="Search…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        ) : (
          <Text style={styles.tabTitle}>Timeline</Text>
        )}

        <View style={styles.iconGroup}>
          <TouchableOpacity onPress={toggleSearch}>
            <Ionicons name="search-outline" size={24} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openFilterModal} style={styles.iconSpacing}>
            <Ionicons name="filter-outline" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      {/* FILTER / ACTION BAR */}
      {isSelecting ? (
        <View style={styles.actionBar}>
          <TouchableOpacity onPress={clearSelection}>
            <Ionicons name="close-outline" size={24} />
          </TouchableOpacity>
          <View style={styles.actionButtons}>
            <TouchableOpacity onPress={() => toggleFavorite(selectedIds)}>
              <Ionicons name="star" size={24} color="gold" />
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={24} color="red" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={toggleAll}>
            <Ionicons
              name={selectedIds.length === totalCount ? 'checkbox' : 'square-outline'}
              size={24}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterBar}
        >
          {activeFilters.map(f => (
            <TouchableOpacity
              key={f.type}
              style={styles.chip}
              onPress={() => removeFilter(f.type)}
            >
              <Text style={styles.chipText}>{f.label}</Text>
              <Ionicons name="close-circle" size={16} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* SEGMENT LIST */}
      <View style={styles.listWrapper}>
        <ScrollView
          contentContainerStyle={styles.listContent}
          onLayout={e => setContainerHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => setContentHeight(h)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {sections.length === 0 ? (
            <Text style={styles.empty}>No segments available</Text>
          ) : (
            sections.map((sec: TimelineSection) => (
              <View key={sec.title} style={styles.groupContainer}>
                <View style={styles.bullet} />
                <View style={styles.verticalLine} />
                <View style={styles.sectionContent}>
                  <Text style={styles.headerText}>{sec.title}</Text>
                  {sec.data.map(item => {
                    const selected = selectedIds.includes(item.id);
                    const fav = favoriteList.includes(item.id);
                    const secs = Math.round((item.durationMillis / 1000) % 60);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.item, selected && styles.itemSelected]}
                        onPress={() =>
                          isSelecting
                            ? toggleSelect(item.id)
                            : router.push({
                                pathname: '/ConversationDetail',
                                params: {
                                  transcription: item.transcription,
                                  timestampStart: String(item.timestampStart),
                                  timestampEnd: String(item.timestampEnd),
                                  durationMillis: String(item.durationMillis),
                                },
                              })
                        }
                        onLongPress={() => longPressSelect(item.id)}
                      >
                        <View style={styles.itemContent}>
                          <View style={styles.metaRow}>
                            <Text style={styles.timestamp}>
                              Time: {new Date(item.timestampEnd).toLocaleTimeString()}
                            </Text>
                            <Text style={styles.duration}>
                              Duration: {secs} sec
                            </Text>
                          </View>
                          <Text style={styles.preview}>
                            {item.transcription.slice(0, 80)}…
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.starBtn}
                          onPress={() => toggleFavorite([item.id])}
                        >
                          <Ionicons
                            name={fav ? 'star' : 'star-outline'}
                            size={20}
                            color={fav ? 'gold' : 'gray'}
                          />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {scrollY > 0 && (
          <LinearGradient
            colors={['#f9f9f9', 'transparent']}
            style={styles.topFade}
          />
        )}
        {scrollY + containerHeight < contentHeight && (
          <LinearGradient
            colors={['transparent', '#f9f9f9']}
            style={styles.bottomFade}
          />
        )}
      </View>

      {/* FILTER MODAL */}
      <Modal
        transparent
        animationType="fade"
        visible={showFilterModal}
        onRequestClose={closeFilterModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Filters</Text>
            <View style={styles.pickerRow}>
              <DatePickerField
                label="From"
                date={fromDate}
                onPress={() => setPickerMode('from')}
                onChange={(e) => {
                  const v = e.target.value;
                  setFromDate(v ? new Date(v) : null);
                }}
              />
              <DatePickerField
                label="To"
                date={toDate}
                onPress={() => setPickerMode('to')}
                onChange={(e) => {
                  const v = e.target.value;
                  setToDate(v ? new Date(v) : null);
                }}
              />
            </View>
            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setSortAsc(p => !p)}
              >
                <Ionicons name={sortAsc ? 'arrow-up' : 'arrow-down'} size={20} />
                <Text style={styles.optionText}>
                  {sortAsc ? 'Oldest first' : 'Newest first'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setShowFavoritesOnly(p => !p)}
              >
                <Ionicons
                  name={showFavoritesOnly ? 'star' : 'star-outline'}
                  size={20}
                />
                <Text style={styles.optionText}>Favorites only</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={closeFilterModal}
            >
              <Text>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MOBILE DATE PICKER */}
      {pickerMode && Platform.OS !== 'web' && (
        <DateTimePicker
          mode="date"
          value={(pickerMode === 'from' ? fromDate : toDate) || new Date()}
          onChange={(_, d) => {
            setPickerMode(null);
            if (d) (pickerMode === 'from' ? setFromDate : setToDate)(d);
          }}
        />
      )}

      {/* DELETE CONFIRMATION */}
      <Modal
        transparent
        animationType="fade"
        visible={showDeleteModal}
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Confirm deletion</Text>
            <Text style={styles.modalMessage}>
              Do you want to delete this segment?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={cancelDelete}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', padding: 8 },

  /* header */
  navBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  tabTitle: { marginLeft: 8, fontSize: 18, fontWeight: 'bold' },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  iconGroup: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  iconSpacing: { marginLeft: 8 },

  /* filter / action bars */
  filterScroll: { maxHeight: 36, minHeight: 36, flexGrow: 0 },
  filterBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    marginRight: 6,
  },
  chipText: { marginRight: 4 },

  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  actionButtons: { flexDirection: 'row', columnGap: 16 },

  /* list */
  listWrapper: { flex: 1, marginTop: 4, position: 'relative' },
  listContent: { paddingBottom: 16 },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: FADE_HEIGHT },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },

  groupContainer: { marginBottom: 16, position: 'relative' },
  bullet: {
    position: 'absolute',
    top: 4,
    left: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#888',
    backgroundColor: '#f9f9f9',
    zIndex: 1,
  },
  verticalLine: {
    position: 'absolute',
    top: 12,
    bottom: 0,
    left: 15,
    width: 2,
    backgroundColor: '#888',
  },
  sectionContent: { marginLeft: 32 },
  headerText: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginVertical: 4,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 6,
  },
  itemSelected: { borderWidth: 2, borderColor: '#007AFF' },
  itemContent: { flex: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  timestamp: { fontSize: 12, color: 'gray' },
  duration: { fontSize: 12, color: 'gray' },
  preview: { fontSize: 14, fontWeight: '500' },
  starBtn: { marginLeft: 10, padding: 4 },
  empty: { textAlign: 'center', marginTop: 20, color: '#888' },

  /* modals */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalMessage: { fontSize: 16, marginBottom: 20, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-around' },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  cancelButton: { backgroundColor: '#ccc' },
  confirmButton: { backgroundColor: '#ff3b30' },
  modalButtonText: { color: '#fff', fontWeight: 'bold' },

  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerGroup: {
    flex: 1,
    alignItems: 'flex-start',
  },
  pickerLabel: {
    fontSize: 12,
    color: 'gray',
    marginBottom: 4,
  },
  pickerBtn: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#f2f2f2',
    marginHorizontal: 4,
  },
  webDate: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    marginHorizontal: 4,
  },

  modalOptions: { marginBottom: 16 },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  optionText: { marginLeft: 8 },

  modalClose: { alignSelf: 'flex-end', paddingTop: 8 },
  confirmRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  cancelBtn: { padding: 8, marginRight: 8 },
  okBtn: { padding: 8 },
});
