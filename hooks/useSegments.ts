// hooks/useSegments.ts

import { useEffect, useState } from 'react';
import { loadSegments, saveSegments } from '../services/storageService';

export interface Segment {
  id: string;
  timestampStart:   number; // ✅ Added for duration calculation
  timestampEnd:     number; // ✅ Added for timeline display
  durationMillis:   number; // ✅ Added for duration calculation
  transcription:    string; // ✅ Added for persistent transcription on native
  audioUri:         string; // ✅ Added for persistent audio on native
  audioBase64:      string; // ✅ Added for persistent audio on web
}


export function useSegments() {
  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    (async () => {
      const stored = await loadSegments();
      setSegments(stored);
    })();
  }, []);

  /**
   * Append a new segment to the list, avoiding overwrite due to stale state.
   */
  const addSegment = (newSegment: Segment) => {
    setSegments((prevSegments) => {
      const updated = [...prevSegments, newSegment].sort(
        (a, b) => a.timestampEnd - b.timestampEnd
      );
      saveSegments(updated);
      return updated;
    });
  };

  const removeSegment = (id: string) => {
    setSegments((prevSegments) => {
      const updated = prevSegments.filter((seg) => seg.id !== id);
      saveSegments(updated);
      return updated;
    });
  };

  const clearSegments = () => {
    setSegments([]);
    saveSegments([]);
  };

  return {
    segments,
    setSegments,
    addSegment,
    removeSegment,
    clearSegments,
  };
}
