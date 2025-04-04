// hooks/useSegments.ts

import { useEffect, useState } from 'react';
import { loadSegments, saveSegments } from '../services/storageService';

export interface Segment {
  id: string;
  timestamp: number;
  transcription: string;
  audioUri: string;
  audioBase64?: string; // ✅ Added for persistent audio on web
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
        (a, b) => a.timestamp - b.timestamp
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
