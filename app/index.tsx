import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Audio } from 'expo-av';
import axios from 'axios';
import Colors from '../constants/Colors';
import { Platform as RNPlatform } from 'react-native';
import Voice from '@react-native-voice/voice';
import { useNavigation } from '@react-navigation/native';

export default function MainPage() {
  const [recording, setRecording] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [days, setDays] = useState<string>('');
  const [hours, setHours] = useState<string>('');
  const [minutes, setMinutes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredTranscriptions, setFilteredTranscriptions] = useState<string[]>([]);
  const [audioRecording, setAudioRecording] = useState<Audio.Recording | null>(null);
  const webRecognitionRef = useRef<any>(null);
  
  const navigation = useNavigation();

  useEffect(() => {
    // Request Audio Permissions
    (async () => {
      await Audio.requestPermissionsAsync();
    })();
  }, []);

  const startRecording = async () => {
    setRecording(true);
    // Recording logic here
  };

  const stopRecording = async () => {
    setRecording(false);
    // Stopping logic here
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={RNPlatform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search conversations..."
          placeholderTextColor={Colors.light.text}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        <View style={styles.centerContent}>
          <TouchableOpacity
            style={styles.recordButton}
            onPress={() => {
              setRecording(!recording);
              if (recording) stopRecording();
              else startRecording();
            }}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{recording ? 'Stop Recording' : 'Start Recording'}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.timeContainer}>
          <TextInput
            style={styles.timeInput}
            placeholder="Days"
            keyboardType="numeric"
            value={days}
            onChangeText={setDays}
          />
          <TextInput
            style={styles.timeInput}
            placeholder="Hours"
            keyboardType="numeric"
            value={hours}
            onChangeText={setHours}
          />
          <TextInput
            style={styles.timeInput}
            placeholder="Minutes"
            keyboardType="numeric"
            value={minutes}
            onChangeText={setMinutes}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 20, backgroundColor: Colors.light.background },
  searchBar: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recordButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  buttonText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timeInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 16,
    backgroundColor: '#fff',
    marginHorizontal: 5,
  },
});
