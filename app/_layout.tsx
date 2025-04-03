// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'LifeLog' }} /> {/* "index" is now your main page */}
      <Stack.Screen name="ConversationDetail" options={{ title: 'Conversation Detail' }} />
      <Stack.Screen name="SearchResults" options={{ title: 'Search Results' }} />
    </Stack>
  );
}
