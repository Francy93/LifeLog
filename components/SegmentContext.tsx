// components/SegmentContext.tsx
import React, { createContext, useContext, ReactNode, useState } from 'react';
import { useSegments, Segment } from '../hooks/useSegments';

export interface SegmentWithWords extends Segment {
  words?: { word: string; startTime: number; endTime: number }[];
}

type SegmentContextType = ReturnType<typeof useSegments> & {
  recording: boolean;
  setRecording: React.Dispatch<React.SetStateAction<boolean>>;
  activeSegment?: SegmentWithWords;
  setActiveSegment: React.Dispatch<React.SetStateAction<SegmentWithWords | undefined>>;
};

const SegmentContext = createContext<SegmentContextType | undefined>(undefined);

export const SegmentProvider = ({ children }: { children: ReactNode }) => {
  const segmentState = useSegments();
  const [recording, setRecording] = useState<boolean>(false);
  const [activeSegment, setActiveSegment] = useState<SegmentWithWords | undefined>();

  return (
    <SegmentContext.Provider
      value={{ ...segmentState, recording, setRecording, activeSegment, setActiveSegment }}
    >
      {children}
    </SegmentContext.Provider>
  );
};

export const useSegmentContext = (): SegmentContextType => {
  const context = useContext(SegmentContext);
  if (!context) throw new Error('useSegmentContext must be used within a SegmentProvider');
  return context;
};
