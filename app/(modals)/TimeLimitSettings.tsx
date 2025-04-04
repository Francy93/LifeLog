import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTimeLimit } from '../../hooks/useTimeLimit';

export default function TimeLimitSettings() {
  const {
    days, hours, minutes,
    setDays, setHours, setMinutes
  } = useTimeLimit();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Days:</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={days}
        onChangeText={setDays}
      />
      <Text style={styles.label}>Hours:</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={hours}
        onChangeText={setHours}
      />
      <Text style={styles.label}>Minutes:</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={minutes}
        onChangeText={setMinutes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 16,
    marginTop: 10,
  },
  input: {
    borderBottomWidth: 1,
    fontSize: 18,
    padding: 5,
    marginVertical: 5,
  },
});
