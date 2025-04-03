// app/searchResults.tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function SearchResults() {
  const router = useRouter();
  const { results } = useLocalSearchParams<{ results: string }>();

  // Parse the results from a JSON string back into an array
  const parsedResults: string[] = results ? JSON.parse(results) : [];

  const handleSelect = (item: string) => {
    // Navigate to conversationDetail, passing data as query parameters.
    router.push({
      pathname: '/ConversationDetail',
      params: { transcription: item, audioUri: 'YOUR_AUDIO_URI' }, // Replace YOUR_AUDIO_URI appropriately
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={parsedResults}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleSelect(item)}>
            <View style={styles.item}>
              <Text>{item}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  item: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
});
