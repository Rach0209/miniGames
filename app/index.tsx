import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: "Baek's test Games" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Baek's test Games</Text>
        <Text style={styles.subtitle}>게임을 선택하세요</Text>

        <TouchableOpacity
          style={styles.gameCard}
          onPress={() => router.push('/jamo-wordle')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🔤</Text>
          <View>
            <Text style={styles.gameName}>단어 맞추기 게임</Text>
            <Text style={styles.gameDesc}>5자모로 2글자 한국어 단어 맞추기</Text>
          </View>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121213',
    padding: 24,
    paddingTop: 48,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#818384',
    fontSize: 16,
    marginBottom: 32,
  },
  gameCard: {
    backgroundColor: '#1A1A1B',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  gameEmoji: {
    fontSize: 40,
  },
  gameName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gameDesc: {
    color: '#818384',
    fontSize: 13,
    marginTop: 2,
  },
});
