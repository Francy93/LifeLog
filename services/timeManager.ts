// services/timeManager.ts
export const enforceTimeLimit = (segments: any[], days: string, hours: string, minutes: string): any[] => {
    const limitMs = (parseInt(days) * 24 * 60 + parseInt(hours) * 60 + parseInt(minutes)) * 60 * 1000;
    if (limitMs <= 0) return segments;
    const currentTime = Date.now();
    return segments.filter(segment => currentTime - segment.timestamp <= limitMs);
  };
  