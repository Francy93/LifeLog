// hooks/useSegments.ts
import { useEffect, useState } from 'react';
import { loadSegments, saveSegments } from '../services/storageService';

export interface Segment {
  id: string;
  timestampStart: number;
  timestampEnd: number;
  durationMillis: number;
  transcription: string;
  audioUri: string;
  audioBase64: string;
  favorite: boolean;
  words?: { word: string; startTime: number; endTime: number }[];
}

export function useSegments() {
  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    (async () => {
      const stored = await loadSegments();
      setSegments(stored);
    })();
  }, []);

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

  const getSegmentIndexByTimestamp = (timestamp: number): number => {
    return segments.findIndex(seg => seg.timestampStart === timestamp);
  };

  const getAdjacentSegments = (index: number): Segment[] => {
    return segments.slice(Math.max(0, index - 1), index + 2);
  };

  return {
    segments,
    setSegments,
    addSegment,
    removeSegment,
    clearSegments,
    getSegmentIndexByTimestamp,
    getAdjacentSegments,
  };
}
