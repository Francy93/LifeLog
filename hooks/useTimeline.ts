// hooks/useTimeline.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Segment, useSegments } from './useSegments';

type FilterType = 'search' | 'date' | 'sort' | 'favorites';
export interface TimelineSection {
  title: string;
  data: Segment[];
}

const FAVORITES_KEY = 'favoriteSegments';

// Hoisted date helpers
const startOfDay = (d: Date) => new Date(d.setHours(0, 0, 0, 0));
const endOfDay = (d: Date) => new Date(d.setHours(23, 59, 59, 999));

export function useTimeline() {
  /* Core */
  const { segments, removeSegment, setSegments: replaceSegments } = useSegments();

  /* Filters/UI */
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  /* Selection */
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  /* Favorites persistence */
  const [favoriteList, setFavoriteList] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then(raw => {
      if (raw) setFavoriteList(JSON.parse(raw));
    });
  }, []);

  /* Toggle favorite on IDs */
  const toggleFavorite = useCallback(
    (ids: string[]) => {
      replaceSegments(prev =>
        prev.map(seg =>
          ids.includes(seg.id) ? { ...seg, favorite: !seg.favorite } : seg
        )
      );
      setFavoriteList(prev => {
        const allFav = ids.every(id => prev.includes(id));
        const next = allFav
          ? prev.filter(id => !ids.includes(id))
          : Array.from(new Set([...prev, ...ids]));
        AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
        return next;
      });
    },
    [replaceSegments]
  );

  /* Delete flow */
  const confirmDelete = () => setShowDeleteModal(true);
  const cancelDelete = () => setShowDeleteModal(false);
  const performDelete = useCallback(() => {
    selectedIds.forEach(id => removeSegment(id));
    setSelectedIds([]);
    setIsSelecting(false);
    setShowDeleteModal(false);
  }, [removeSegment, selectedIds]);

  /* Multi-select handlers */
  const longPressSelect = useCallback((id: string) => {
    setSelectedIds([id]);
    setIsSelecting(true);
  }, []);
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setIsSelecting(false);
  }, []);

  /* Filtered segments */
  const filtered: Segment[] = useMemo(() => {
    return segments
      .filter(seg =>
        searchQuery
          ? seg.transcription.toLowerCase().includes(searchQuery.toLowerCase())
          : true
      )
      .filter(seg => {
        const end = new Date(seg.timestampEnd);
        if (fromDate && end < startOfDay(fromDate)) return false;
        if (toDate && end > endOfDay(toDate)) return false;
        return true;
      })
      .filter(seg =>
        showFavoritesOnly ? favoriteList.includes(seg.id) : true
      )
      .sort((a, b) =>
        sortAsc ? a.timestampEnd - b.timestampEnd : b.timestampEnd - a.timestampEnd
      );
  }, [
    segments,
    searchQuery,
    fromDate,
    toDate,
    sortAsc,
    showFavoritesOnly,
    favoriteList,
  ]);

  /* Sections grouping */
  const sections: TimelineSection[] = useMemo(() => {
    const groups: TimelineSection[] = [];
    let bucket: Segment[] = [];

    const flush = () => {
      if (!bucket.length) return;
      const oldestEnd = Math.min(...bucket.map(s => s.timestampEnd));
      const d = new Date(oldestEnd);
      groups.push({
        title: `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`,
        data: [...bucket],
      });
      bucket = [];
    };

    filtered.forEach(seg => {
      const lastEnd = bucket.length ? bucket[bucket.length - 1].timestampEnd : null;
      const gap =
        lastEnd == null || Math.abs(seg.timestampEnd - lastEnd) < 5 * 60 * 1000;
      if (gap) {
        bucket.push(seg);
      } else {
        flush();
        bucket.push(seg);
      }
    });
    flush();
    return groups;
  }, [filtered]);

  /* Multi‐select “all” / “none” */
  const selectAll = useCallback(() => {
    setIsSelecting(true);
    setSelectedIds(filtered.map(s => s.id));
  }, [filtered]);
  const deselectAll = useCallback(() => setSelectedIds([]), []);

  /* Active filter chips */
  const activeFilters = useMemo(() => {
    const chips: { type: FilterType; label: string }[] = [];
    if (searchQuery) chips.push({ type: 'search', label: `“${searchQuery}”` });
    if (fromDate || toDate) {
      const f = (d: Date) => d.toLocaleDateString();
      chips.push({
        type: 'date',
        label: `${fromDate ? f(fromDate) : '…'} → ${toDate ? f(toDate) : '…'}`,
      });
    }
    if (sortAsc) chips.push({ type: 'sort', label: 'Oldest first' });
    if (showFavoritesOnly)
      chips.push({ type: 'favorites', label: '★ Favorited' });
    return chips;
  }, [searchQuery, fromDate, toDate, sortAsc, showFavoritesOnly]);

  /* Remove one filter */
  const removeFilter = useCallback((type: FilterType) => {
    switch (type) {
      case 'search':
        setSearchQuery('');
        break;
      case 'date':
        setFromDate(null);
        setToDate(null);
        break;
      case 'sort':
        setSortAsc(false);
        break;
      case 'favorites':
        setShowFavoritesOnly(false);
        break;
    }
  }, []);

  return {
    segments,
    sections,

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
    openFilterModal: () => setShowFilterModal(true),
    closeFilterModal: () => setShowFilterModal(false),
    activeFilters,
    removeFilter,

    isSelecting,
    selectedIds,
    longPressSelect,
    toggleSelect,
    selectAll,
    clearSelection,
    deselectAll,

    favoriteList,
    toggleFavorite,

    showDeleteModal,
    confirmDelete,
    cancelDelete,
    performDelete,
  };
}
