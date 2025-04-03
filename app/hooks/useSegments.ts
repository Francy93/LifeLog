// app/hooks/useSegments.ts

import { useEffect, useState } from 'react';
import { loadSegments, saveSegments } from '../../services/storageService';


export interface Segment {
  id: string;
  timestamp: number;
  transcription: string;
  audioUri: string;
}

export function useSegments() {
  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    (async () => {
      const stored = await loadSegments();
      setSegments(stored);
    })();
  }, []);

  const addSegment = async (newSegment: Segment) => {
    const updated = [...segments, newSegment].sort((a, b) => a.timestamp - b.timestamp);
    setSegments(updated);
    await saveSegments(updated);
  };

  const removeSegment = async (id: string) => {
    const updated = segments.filter(seg => seg.id !== id);
    setSegments(updated);
    await saveSegments(updated);
  };

  const clearSegments = async () => {
    setSegments([]);
    await saveSegments([]);
  };

  return {
    segments,
    setSegments,
    addSegment,
    removeSegment,
    clearSegments,
  };
}
