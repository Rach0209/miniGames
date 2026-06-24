import { useEffect, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithGoogle, signOut, onAuthStateChange } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const insets = useSafeAreaInsets();

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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
      >

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
          <View style={styles.cardInfo}>
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
          <View style={styles.cardInfo}>
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
          <View style={styles.cardInfo}>
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
          <View style={styles.cardInfo}>
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
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>패턴 기억 게임</Text>
            <Text style={styles.gameDesc}>깜박이는 순서를 기억하고 탭하세요 (4×4~10×10)</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/ascii-art')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>✨</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>텍스트 아트</Text>
            <Text style={styles.gameDesc}>텍스트를 블록 글자, 이모지, 뒤집기 등으로 변환</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/catch-mind')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🎨</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>캐치 마인드</Text>
            <Text style={styles.gameDesc}>그림을 그려 출제하거나, 다른 사람 그림을 맞춰보세요 🔒</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/pixel-art')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🧱</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>도트 변환기</Text>
            <Text style={styles.gameDesc}>이미지를 업로드하면 도트 아트로 바꿔드려요 (웹 전용)</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/flappy-bird')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🐥</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>플래피 버드</Text>
            <Text style={styles.gameDesc}>탭해서 날아올라 파이프를 통과하세요!</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/snake')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🐍</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>뱀 게임</Text>
            <Text style={styles.gameDesc}>먹이를 먹으며 길어지는 뱀을 조종하세요</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/whack-a-mole')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🐹</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>두더지 잡기</Text>
            <Text style={styles.gameDesc}>튀어나오는 두더지를 빠르게 탭하세요! ⭐ +3 💣 -1</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/tetris')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🧱</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>테트리스</Text>
            <Text style={styles.gameDesc}>블록을 쌓아 줄을 완성하세요! 방향키/스와이프 지원</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/lights-out')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>💡</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>라이트 아웃</Text>
            <Text style={styles.gameDesc}>탭하면 주변 칸도 토글 — 모든 불을 꺼보세요!</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/numberlink')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🔗</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>넘버링크</Text>
            <Text style={styles.gameDesc}>같은 숫자끼리 선으로 연결하고 모든 칸을 채우세요!</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gameCard, { marginTop: 16 }]}
          onPress={() => router.push('/nonogram')}
          activeOpacity={0.8}
        >
          <Text style={styles.gameEmoji}>🖼️</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.gameName}>노노그램</Text>
            <Text style={styles.gameDesc}>숫자 힌트로 그림을 완성하는 픽처로직 퍼즐!</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#121213',
  },
  container: {
    flexGrow: 1,
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
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    flexShrink: 1,
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
