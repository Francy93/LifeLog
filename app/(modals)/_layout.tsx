// app/(modals)/_layout.tsx
import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal', // or 'card' if you want normal stack transitions
        headerShown: true,
      }}
    />
  );
}
