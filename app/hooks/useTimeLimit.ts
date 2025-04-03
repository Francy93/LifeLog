// app/hooks/useTimeLimit.ts

import { useEffect, useState } from 'react';
import { loadTimeLimit, saveTimeLimit } from '../../services/storage';

export function useTimeLimit() {
  const [days, setDays] = useState('0');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');

  useEffect(() => {
    (async () => {
      const saved = await loadTimeLimit();
      if (saved) {
        setDays(saved.days.toString());
        setHours(saved.hours.toString());
        setMinutes(saved.minutes.toString());
      }
    })();
  }, []);

  useEffect(() => {
    const parsed = {
      days: parseInt(days, 10) || 0,
      hours: parseInt(hours, 10) || 0,
      minutes: parseInt(minutes, 10) || 0,
    };
    saveTimeLimit(parsed);
  }, [days, hours, minutes]);

  return {
    days,
    hours,
    minutes,
    setDays,
    setHours,
    setMinutes,
  };
}
