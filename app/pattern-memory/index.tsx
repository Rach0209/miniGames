import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { loadPatternMemoryStats, updatePatternMemoryStats, PatternMemoryStats } from '../../utils/patternMemoryStorage';
import InfoModal from '../../components/InfoModal';
import LeaderboardView from '../../components/LeaderboardView';

// ── 상수 ──────────────────────────────────────────────────────────────────────
const GRID_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];
const GAP = 4;

const COLOR_OFF = '#3A3A3C';
const COLOR_ON  = '#FFD700';
const COLOR_ERR = '#FF3B30';

type Phase = 'idle' | 'showing' | 'input' | 'correct' | 'gameover';
type Tab = 'game' | 'ranking';

const ACCENT = '#FFD700';

const RULES_PATTERN = [
  { emoji: '👁', text: '셀이 깜박이는 순서를 기억하세요.' },
  { emoji: '👆', text: '같은 순서대로 셀을 탭하세요.' },
  { emoji: '✅', text: '다 맞히면 다음 라운드 — 시퀀스가 1개씩 늘어요.' },
  { emoji: '⚡', text: '라운드가 올라갈수록 표시 속도가 빨라져요.' },
  { emoji: '🔲', text: '4×4부터 10×10까지 난이도를 선택할 수 있어요.' },
  { emoji: '💾', text: '최고 라운드는 로그인 시 저장돼요.' },
];

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function PatternMemoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const effectiveW = Math.min(screenWidth, 1600);
  const BOARD_SIZE = Math.min(effectiveW - 32, effectiveW * 0.65);

  // 반응형 그리드 선택 버튼
  const GRID_BTN_GAP = 16;
  const containerW = Math.min(effectiveW - 48, BOARD_SIZE);
  const cols = Math.min(
    GRID_OPTIONS.length,
    Math.max(2, Math.floor((containerW + GRID_BTN_GAP) / (80 + GRID_BTN_GAP)))
  );
  const GRID_BTN_SIZE = Math.min(180, Math.floor((containerW - GRID_BTN_GAP * (cols - 1)) / cols));
  const [gridSize, setGridSize] = useState(4);
  const [phase, setPhase] = useState<Phase>('idle');
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [errorCell, setErrorCell] = useState<number | null>(null);
  const [stats, setStats] = useState<PatternMemoryStats>({ totalGames: 0, highScore: 0, distribution: Array(30).fill(0) });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [tab, setTab] = useState<Tab>('game');

  // 애니메이션: 셀별 밝기 (0=꺼짐, 1=켜짐)
  const cellAnims = useRef<Animated.Value[]>([]);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    loadPatternMemoryStats().then(setStats);
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
  }, []);

  const cellSize = (BOARD_SIZE - GAP * (gridSize + 1)) / gridSize;

  const clearTimeouts = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  }, []);

  // 셀 애니메이션 배열 초기화
  const initAnims = useCallback((size: number) => {
    cellAnims.current = Array(size * size).fill(null).map(() => new Animated.Value(0));
  }, []);

  const flashCell = useCallback((idx: number, color: 'on' | 'err' = 'on') => {
    const anim = cellAnims.current[idx];
    if (!anim) return;
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: color === 'on' ? 1 : 2, duration: 150, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start();
  }, []);

  const showSequence = useCallback((seq: number[], size: number) => {
    setPhase('showing');
    setPlayerInput([]);
    clearTimeouts();

    const round = seq.length;
    const interval = Math.max(300, 700 - (round - 1) * 20);

    seq.forEach((cellIdx, i) => {
      const t1 = setTimeout(() => flashCell(cellIdx, 'on'), i * interval + 400);
      timeouts.current.push(t1);
    });

    const endT = setTimeout(() => {
      setPhase('input');
    }, seq.length * interval + 700);
    timeouts.current.push(endT);
  }, [clearTimeouts, flashCell]);

  const startGame = useCallback((size: number) => {
    clearTimeouts();
    initAnims(size);
    const firstCell = Math.floor(Math.random() * size * size);
    const seq = [firstCell];
    setSequence(seq);
    setPlayerInput([]);
    setRound(1);
    setScore(0);
    setErrorCell(null);
    // 짧은 딜레이 후 시작 (애니메이션 초기화 대기)
    const t = setTimeout(() => showSequence(seq, size), 200);
    timeouts.current.push(t);
  }, [clearTimeouts, initAnims, showSequence]);

  const handleCellPress = useCallback((cellIdx: number) => {
    if (phase !== 'input') return;

    const idx = playerInput.length;

    if (cellIdx !== sequence[idx]) {
      // 오답
      setErrorCell(cellIdx);
      flashCell(cellIdx, 'err');
      const t = setTimeout(() => {
        setErrorCell(null);
        setPhase('gameover');
        updatePatternMemoryStats(score).then(setStats);
      }, 600);
      timeouts.current.push(t);
      return;
    }

    flashCell(cellIdx, 'on');
    const newInput = [...playerInput, cellIdx];

    if (newInput.length === sequence.length) {
      // 라운드 클리어
      const newScore = score + 1;
      setScore(newScore);
      setPhase('correct');
      const nextCell = Math.floor(Math.random() * gridSize * gridSize);
      const nextSeq = [...sequence, nextCell];
      setSequence(nextSeq);
      setRound(r => r + 1);
      const t = setTimeout(() => showSequence(nextSeq, gridSize), 700);
      timeouts.current.push(t);
    } else {
      setPlayerInput(newInput);
    }
  }, [phase, playerInput, sequence, score, gridSize, flashCell, showSequence]);

  useEffect(() => () => clearTimeouts(), [clearTimeouts]);

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  const phaseLabel = () => {
    if (phase === 'showing') return '기억하세요...';
    if (phase === 'input') return `탭하세요! (${playerInput.length}/${sequence.length})`;
    if (phase === 'correct') return '정답! 다음 라운드...';
    if (phase === 'gameover') return '게임오버';
    return '';
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '패턴 기억',
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
        title="패턴 기억 게임"
        description="셀이 깜박이는 순서를 기억하고 같은 순서로 탭하세요!"
        rules={RULES_PATTERN}
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
            gameType="pattern-memory"
            ascending={false}
            valueFormatter={v => `${v}라운드`}
            subtitle="높을수록 좋아요"
            accentColor={ACCENT}
            isLoggedIn={isLoggedIn}
          />
        </View>
      ) : (
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 정보 */}
        {phase !== 'idle' && (
          <View style={styles.infoRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{gridSize}×{gridSize}</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreLabel}>라운드</Text>
              <Text style={styles.scoreValue}>{round}</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreLabel}>최고</Text>
              <Text style={styles.scoreValue}>{stats.highScore}</Text>
            </View>
          </View>
        )}

        {/* 상태 레이블 */}
        {phase !== 'idle' && phase !== 'gameover' && (
          <Text style={styles.phaseLabel}>{phaseLabel()}</Text>
        )}

        {/* 그리드 */}
        {phase !== 'idle' && (
          <View style={[styles.board, { width: BOARD_SIZE, height: BOARD_SIZE }]}>
            {Array(gridSize * gridSize).fill(null).map((_, cellIdx) => {
              const anim = cellAnims.current[cellIdx];
              const bgColor = anim
                ? anim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [COLOR_OFF, COLOR_ON, COLOR_ERR],
                  })
                : COLOR_OFF;
              const row = Math.floor(cellIdx / gridSize);
              const col = cellIdx % gridSize;
              const x = GAP + col * (cellSize + GAP);
              const y = GAP + row * (cellSize + GAP);
              return (
                <Animated.View
                  key={cellIdx}
                  style={[
                    styles.cell,
                    {
                      width: cellSize,
                      height: cellSize,
                      left: x,
                      top: y,
                      backgroundColor: bgColor,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    onPress={() => handleCellPress(cellIdx)}
                    disabled={phase !== 'input'}
                    activeOpacity={0.7}
                  />
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* 게임오버 오버레이 */}
        {phase === 'gameover' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayEmoji}>😢</Text>
            <Text style={styles.overlayTitle}>게임오버</Text>
            <Text style={styles.overlayScore}>{round - 1}라운드 완료</Text>
            <TouchableOpacity style={styles.overlayBtn} onPress={() => startGame(gridSize)}>
              <Text style={styles.overlayBtnText}>{gridSize}×{gridSize} 다시 시작</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnSecondary]} onPress={() => setPhase('idle')}>
              <Text style={styles.overlayBtnText}>크기 변경</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* idle 화면: 크기 선택 */}
        {phase === 'idle' && (
          <View style={styles.idleContainer}>
            <Text style={styles.idleTitle}>🔲 패턴 기억 게임</Text>
            <Text style={styles.idleDesc}>그리드 크기를 선택하세요</Text>
            <Text style={styles.idleHighScore}>최고 라운드: {stats.highScore > 0 ? `${stats.highScore}라운드` : '기록 없음'}</Text>

            <View style={[styles.gridOptions, { gap: GRID_BTN_GAP, width: containerW }]}>
              {GRID_OPTIONS.map(size => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.gridOption,
                    { width: GRID_BTN_SIZE, height: GRID_BTN_SIZE },
                    gridSize === size && styles.gridOptionSelected,
                  ]}
                  onPress={() => setGridSize(size)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.gridOptionText, gridSize === size && styles.gridOptionTextSelected]}>
                    {size}×{size}
                  </Text>
                  <Text style={[styles.gridOptionSub, gridSize === size && styles.gridOptionTextSelected]}>
                    {size * size}칸
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.startBtn} onPress={() => startGame(gridSize)} activeOpacity={0.8}>
              <Text style={styles.startBtnText}>시작</Text>
            </TouchableOpacity>

            {!isLoggedIn && (
              <Text style={styles.guestNote}>🔒 로그인하면 최고 라운드가 저장돼요</Text>
            )}
          </View>
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
  scrollContainer: {
    flex: 1,
    backgroundColor: '#121213',
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  badgeText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scoreBox: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 64,
  },
  scoreLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  scoreValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  phaseLabel: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  board: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    position: 'relative',
  },
  cell: {
    position: 'absolute',
    borderRadius: 6,
  },
  overlay: {
    marginTop: 24,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  overlayEmoji: { fontSize: 48 },
  overlayTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  overlayScore: { color: '#8E8E93', fontSize: 16, marginBottom: 8 },
  overlayBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  overlayBtnSecondary: {
    backgroundColor: '#3A3A3C',
  },
  overlayBtnText: { color: '#121213', fontSize: 15, fontWeight: 'bold' },
  // idle
  idleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  idleTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  idleDesc: {
    color: '#8E8E93',
    fontSize: 15,
    marginBottom: 6,
  },
  idleHighScore: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 28,
  },
  gridOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 32,
    alignSelf: 'center',
  },
  gridOption: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridOptionSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#2C2C2E',
  },
  gridOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gridOptionTextSelected: {
    color: '#FFD700',
  },
  gridOptionSub: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  startBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 60,
  },
  startBtnText: {
    color: '#121213',
    fontSize: 18,
    fontWeight: 'bold',
  },
  guestNote: {
    color: '#3A3A3C',
    fontSize: 12,
    marginTop: 24,
  },
});
