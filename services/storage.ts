import AsyncStorage from '@react-native-async-storage/async-storage';

const TIME_LIMIT_KEY = 'timeLimit';

// 📤 Carica il time limit salvato
export async function loadTimeLimit() {
  try {
    const savedTime = await AsyncStorage.getItem(TIME_LIMIT_KEY);
    // Se c'è un errore nel parsing, ritorna i valori di default
    const parsedTime = savedTime ? JSON.parse(savedTime) : { days: 0, hours: 0, minutes: 0 };
    
    // Verifica che i dati siano corretti
    if (typeof parsedTime.days === 'number' && typeof parsedTime.hours === 'number' && typeof parsedTime.minutes === 'number') {
      return parsedTime;
    }

    // Se i dati non sono validi, ritorna i valori di default
    return { days: 0, hours: 0, minutes: 0 };
  } catch (error) {
    console.error('Errore nel caricamento del time limit:', error);
    return { days: 0, hours: 0, minutes: 0 };
  }
}

// 📥 Salva il time limit
export async function saveTimeLimit(timeLimit: { days: number; hours: number; minutes: number }) {
  try {
    await AsyncStorage.setItem(TIME_LIMIT_KEY, JSON.stringify(timeLimit));
  } catch (error) {
    console.error('Errore nel salvataggio del time limit:', error);
  }
}
