import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { signInWithGoogle, signOut, onAuthStateChange } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((u) => setUser(u));
    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const { data, error } = await signInWithGoogle();
    if (error) {
      console.error('로그인 오류:', error.message);
      return;
    }
    if (data?.url) {
      Linking.openURL(data.url);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Baek's test Games", headerBackVisible: false, headerLeft: () => null }} />
      <View style={styles.container}>

        {/* 상단 GitHub + 로그인 버튼 */}
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.githubLink}
            onPress={() => Linking.openURL('https://github.com/Rach0209/miniGames')}
            activeOpacity={0.7}
          >
            <Text style={styles.githubText}>⌥ GitHub</Text>
          </TouchableOpacity>

          {user ? (
            <TouchableOpacity style={styles.authButton} onPress={signOut} activeOpacity={0.7}>
              <Text style={styles.authButtonText}>로그아웃</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.authButton} onPress={handleGoogleLogin} activeOpacity={0.7}>
              <Text style={styles.authButtonText}>Google 로그인</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.title}>Baek's test Games</Text>
        <Text style={styles.subtitle}>
          {user ? `${user.email}` : '게임을 선택하세요'}
        </Text>

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

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/color-memory')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🎨</Text>
          <View>
            <Text style={styles.gameName}>색상 기억 게임</Text>
            <Text style={styles.gameDesc}>색상 순서를 기억하고 따라 탭하세요</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/reaction-test')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>⚡</Text>
          <View>
            <Text style={styles.gameName}>반응속도 테스트</Text>
            <Text style={styles.gameDesc}>초록색으로 바뀌는 순간 탭하세요!</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/2048')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🔢</Text>
          <View>
            <Text style={styles.gameName}>2048</Text>
            <Text style={styles.gameDesc}>타일을 합쳐 2048을 만드세요!</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/pattern-memory')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🔲</Text>
          <View>
            <Text style={styles.gameName}>패턴 기억 게임</Text>
            <Text style={styles.gameDesc}>깜박이는 순서를 기억하고 탭하세요 (4×4~10×10)</Text>
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  githubLink: {
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  githubText: {
    color: '#818384',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  authButton: {
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
