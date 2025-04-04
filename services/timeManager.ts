// services/timeManager.ts
export const enforceTimeLimit = (
  segments: any[],
  days: string,
  hours: string,
  minutes: string
): any[] => {
  const limitMs =
    (parseInt(days || '0') * 24 * 60 +
     parseInt(hours || '0') * 60 +
     parseInt(minutes || '0')) * 60 * 1000;

  if (!limitMs || isNaN(limitMs) || limitMs <= 0) {
    return segments; // No limit = keep all
  }

  const now = Date.now();
  let totalTime = 0;
  const result: any[] = [];

  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    const durationGuess = 30000; // Default 30s per chunk, or read from segment if available
    totalTime += durationGuess;
    if (totalTime > limitMs) break;
    result.unshift(segment); // Keep most recent ones
  }

  return result;
};
