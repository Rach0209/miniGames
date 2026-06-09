import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView, useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { loadColorMemoryStats, updateColorMemoryStats, ColorMemoryStats } from '../../utils/colorMemoryStorage';
import InfoModal from '../../components/InfoModal';
import LeaderboardView from '../../components/LeaderboardView';

const COLOR_MEMORY_RULES = [
  { emoji: '👀', text: '색상 타일이 순서대로 점등됩니다. 순서를 잘 기억하세요.' },
  { emoji: '👆', text: '점등이 끝나면 같은 순서대로 타일을 탭하세요.' },
  { emoji: '✅', text: '성공하면 다음 라운드로 넘어가고 색상이 하나 더 추가돼요.' },
  { emoji: '❌', text: '순서가 틀리면 게임이 끝나요.' },
  { emoji: '🏆', text: '몇 라운드까지 기억할 수 있는지 도전해보세요!' },
  { emoji: '💾', text: '최고 기록은 Google 로그인 시 자동 저장돼요.' },
];

const COLORS = [
  { id: 0, bg: '#E53935', label: '빨강' },
  { id: 1, bg: '#1E88E5', label: '파랑' },
  { id: 2, bg: '#43A047', label: '초록' },
  { id: 3, bg: '#FDD835', label: '노랑' },
  { id: 4, bg: '#8E24AA', label: '보라' },
  { id: 5, bg: '#FB8C00', label: '주황' },
];

type Phase = 'idle' | 'showing' | 'input' | 'correct' | 'gameover';
type Tab = 'game' | 'ranking';

const ACCENT = '#FB8C00';

export default function ColorMemoryScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('game');
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [stats, setStats] = useState<ColorMemoryStats>({ totalGames: 0, highScore: 0, distribution: Array(20).fill(0) });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scaleAnims = useRef(COLORS.map(() => new Animated.Value(1)));

  const { width: screenWidth } = useWindowDimensions();
  const TILE_GAP = 16;
  const H_PAD = 40;
  const availW = Math.min(screenWidth, 900) - H_PAD;
  const cols = availW / 3 >= 100 ? 3 : 2;
  const tileSize = Math.min(160, Math.floor((availW - TILE_GAP * (cols - 1)) / cols));

  useEffect(() => {
    loadColorMemoryStats().then(setStats);
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
  }, []);

  const clearTimeouts = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  };

  const flashColor = (colorId: number) => {
    scaleAnims.current[colorId].setValue(1);
    Animated.sequence([
      Animated.timing(scaleAnims.current[colorId], { toValue: 1.15, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnims.current[colorId], { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const showSequence = useCallback((seq: number[]) => {
    setPhase('showing');
    setActiveColor(null);
    clearTimeouts();

    seq.forEach((colorId, i) => {
      const t1 = setTimeout(() => {
        setActiveColor(colorId);
        flashColor(colorId);
      }, i * 700 + 400);

      const t2 = setTimeout(() => {
        setActiveColor(null);
      }, i * 700 + 900);

      timeouts.current.push(t1, t2);
    });

    const endT = setTimeout(() => {
      setPhase('input');
      setPlayerInput([]);
    }, seq.length * 700 + 1000);
    timeouts.current.push(endT);
  }, []);

  const handleStart = useCallback(() => {
    const first = Math.floor(Math.random() * COLORS.length);
    const newSeq = [first];
    setSequence(newSeq);
    setPlayerInput([]);
    setScore(0);
    showSequence(newSeq);
  }, [showSequence]);

  const handleColorPress = useCallback((colorId: number) => {
    if (phase !== 'input') return;

    flashColor(colorId);
    const newInput = [...playerInput, colorId];
    const idx = playerInput.length;

    if (colorId !== sequence[idx]) {
      setPhase('gameover');
      clearTimeouts();
      updateColorMemoryStats(score).then(setStats);
      return;
    }

    if (newInput.length === sequence.length) {
      const newScore = score + 1;
      setScore(newScore);
      setPhase('correct');
      const nextColor = Math.floor(Math.random() * COLORS.length);
      const nextSeq = [...sequence, nextColor];
      setSequence(nextSeq);
      const t = setTimeout(() => showSequence(nextSeq), 800);
      timeouts.current.push(t);
    } else {
      setPlayerInput(newInput);
    }
  }, [phase, playerInput, sequence, score, showSequence]);

  const phaseLabel =
    phase === 'idle' ? '시작 버튼을 누르세요' :
    phase === 'showing' ? '순서를 기억하세요...' :
    phase === 'input' ? '순서대로 탭하세요!' :
    phase === 'correct' ? '정확해요! 계속...' :
    `게임오버! ${score}라운드까지 완료했어요`;

  return (
    <>
      <Stack.Screen
        options={{
          title: '색상 기억 게임',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/')} style={{ paddingHorizontal: 8 }}>
              <Ionicons name="home-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowInfo(true)} style={{ paddingHorizontal: 8 }}>
              <Ionicons name="information-circle-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
      <InfoModal
        visible={showInfo}
        onClose={() => setShowInfo(false)}
        title="색상 기억 게임"
        description="점등되는 색상 순서를 기억하고 똑같이 탭하세요!"
        rules={COLOR_MEMORY_RULES}
      />

      {/* 탭 바 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'game' && styles.tabBtnActive]}
          onPress={() => setTab('game')}
        >
          <Text style={[styles.tabText, tab === 'game' && styles.tabTextActive]}>게임</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'ranking' && styles.tabBtnActive]}
          onPress={() => setTab('ranking')}
        >
          <Text style={[styles.tabText, tab === 'ranking' && styles.tabTextActive]}>🏆 랭킹</Text>
        </TouchableOpacity>
      </View>

      {tab === 'ranking' ? (
        <View style={styles.rankingContainer}>
          <LeaderboardView
            gameType="color-memory"
            ascending={false}
            valueFormatter={v => `${v}라운드`}
            subtitle="높을수록 좋아요"
            accentColor={ACCENT}
            isLoggedIn={isLoggedIn}
          />
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreValue}>{score}</Text>
              <Text style={styles.scoreLabel}>현재</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreValue}>{stats.highScore}</Text>
              <Text style={styles.scoreLabel}>최고</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreValue}>{stats.totalGames}</Text>
              <Text style={styles.scoreLabel}>총 게임</Text>
            </View>
          </View>

          <View style={styles.phaseBox}>
            <Text style={styles.phaseText}>{phaseLabel}</Text>
            {phase === 'input' && (
              <Text style={styles.progressText}>{playerInput.length} / {sequence.length}</Text>
            )}
          </View>

          <View style={[styles.grid, { gap: TILE_GAP, width: cols * tileSize + TILE_GAP * (cols - 1) }]}>
            {COLORS.map((color) => (
              <Animated.View
                key={color.id}
                style={[
                  styles.colorTileWrapper,
                  { width: tileSize, height: tileSize, transform: [{ scale: scaleAnims.current[color.id] }] },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.colorTile,
                    { backgroundColor: color.bg },
                    activeColor === color.id && styles.colorTileActive,
                    phase !== 'input' && styles.colorTileDisabled,
                  ]}
                  onPress={() => handleColorPress(color.id)}
                  activeOpacity={0.75}
                  disabled={phase !== 'input'}
                >
                  <Text style={styles.colorLabel}>{color.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {(phase === 'idle' || phase === 'gameover') && (
            <TouchableOpacity style={styles.startButton} onPress={handleStart} activeOpacity={0.8}>
              <Text style={styles.startButtonText}>
                {phase === 'idle' ? '▶ 시작' : '🔄 다시 하기'}
              </Text>
            </TouchableOpacity>
          )}

          {!isLoggedIn && (
            <Text style={styles.guestNote}>🔒 로그인하면 기록이 저장돼요</Text>
          )}
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1B',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
  },
  tabText: {
    color: '#818384',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: ACCENT,
  },
  rankingContainer: {
    flex: 1,
    backgroundColor: '#121213',
  },
  container: {
    flex: 1,
    backgroundColor: '#121213',
  },
  content: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  scoreBox: {
    alignItems: 'center',
  },
  scoreValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  scoreLabel: {
    color: '#818384',
    fontSize: 12,
    marginTop: 2,
  },
  phaseBox: {
    backgroundColor: '#1A1A1B',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    minWidth: 240,
  },
  phaseText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressText: {
    color: '#538D4E',
    fontSize: 13,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 32,
    alignSelf: 'center',
  },
  colorTileWrapper: {
    // width/height set dynamically via tileSize
  },
  colorTile: {
    flex: 1,
    borderRadius: 16,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 12,
  },
  colorTileActive: {
    opacity: 1,
    borderWidth: 4,
    borderColor: '#fff',
  },
  colorTileDisabled: {
    opacity: 0.6,
  },
  colorLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  startButton: {
    backgroundColor: '#538D4E',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginBottom: 16,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  guestNote: {
    color: '#818384',
    fontSize: 12,
    marginTop: 8,
  },
});
