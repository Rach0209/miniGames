import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#121213' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: '#121213' },
      }}
    />
  );
}
