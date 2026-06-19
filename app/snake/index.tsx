import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, PanResponder, Platform, Modal, ScrollView,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { loadSnakeBest, recordSnakeGame } from '../../utils/snakeStorage';
import LeaderboardView from '../../components/LeaderboardView';

const COLS = 20;
const ROWS = 20;
const TICK_MS = 150;

type Pos = { x: number; y: number };
type Dir = { x: -1 | 0 | 1; y: -1 | 0 | 1 };
type Status = 'idle' | 'playing' | 'gameover';

function randFood(snake: Pos[]): Pos {
  let pos: Pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

const initSnake = (): Pos[] => [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];

export default function SnakeScreen() {
  const { width: rawWidth } = useWindowDimensions();
  const width = rawWidth || 375;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const BOARD_SIZE = Math.min(width - 32, 400);
  const CELL = Math.floor(BOARD_SIZE / COLS);
  const ACTUAL = CELL * COLS;

  const g = useRef({
    snake: initSnake(),
    food: { x: 15, y: 10 } as Pos,
    dir: { x: 1, y: 0 } as Dir,
    nextDir: { x: 1, y: 0 } as Dir,
    score: 0,
    best: 0,
    status: 'idle' as Status,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate(n => n + 1);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    loadSnakeBest().then(best => {
      g.current.best = best;
      rerender();
    });

    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.unsubscribe();
    };
  }, []);

  function beginGame() {
    const state = g.current;
    if (state.status === 'playing') return;
    const snake = initSnake();
    state.snake = snake;
    state.food = randFood(snake);
    state.dir = { x: 1, y: 0 };
    state.nextDir = { x: 1, y: 0 };
    state.score = 0;
    state.status = 'playing';
    rerender();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const s = g.current;
      if (s.status !== 'playing') return;
      s.dir = { ...s.nextDir };
      const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
      if (
        head.x < 0 || head.x >= COLS ||
        head.y < 0 || head.y >= ROWS ||
        s.snake.some(seg => seg.x === head.x && seg.y === head.y)
      ) {
        s.status = 'gameover';
        if (s.score > s.best) {
          s.best = s.score;
        }
        recordSnakeGame(s.score);
        clearInterval(intervalRef.current!);
        rerender();
        return;
      }
      const ate = head.x === s.food.x && head.y === s.food.y;
      s.snake = [head, ...s.snake];
      if (ate) { s.score++; s.food = randFood(s.snake); }
      else { s.snake.pop(); }
      rerender();
    }, TICK_MS);
  }

  function tryChangeDir(dx: -1 | 0 | 1, dy: -1 | 0 | 1) {
    const state = g.current;
    if (state.status !== 'playing') { beginGame(); return; }
    if (dx !== 0 && state.dir.x !== 0) return;
    if (dy !== 0 && state.dir.y !== 0) return;
    state.nextDir = { x: dx, y: dy };
  }

  const panResponder = useRef(PanResponder.create({
    // 탭은 자식 버튼에 전달, 스와이프만 여기서 처리
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 8 || Math.abs(dy) > 8,
    onPanResponderRelease: (_, { dx, dy }) => {
      const state = g.current;
      if (state.status !== 'playing') { beginGame(); return; }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && state.dir.x === 0) state.nextDir = { x: 1, y: 0 };
        else if (dx < 0 && state.dir.x === 0) state.nextDir = { x: -1, y: 0 };
      } else {
        if (dy > 0 && state.dir.y === 0) state.nextDir = { x: 0, y: 1 };
        else if (dy < 0 && state.dir.y === 0) state.nextDir = { x: 0, y: -1 };
      }
    },
  })).current;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      const state = g.current;
      if (e.code === 'Space' || e.key === 'Enter') {
        if (state.status !== 'playing') beginGame();
        e.preventDefault();
        return;
      }
      if (state.status !== 'playing') return;
      if (e.key === 'ArrowUp' && state.dir.y === 0) { state.nextDir = { x: 0, y: -1 }; e.preventDefault(); }
      else if (e.key === 'ArrowDown' && state.dir.y === 0) { state.nextDir = { x: 0, y: 1 }; e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && state.dir.x === 0) { state.nextDir = { x: -1, y: 0 }; e.preventDefault(); }
      else if (e.key === 'ArrowRight' && state.dir.x === 0) { state.nextDir = { x: 1, y: 0 }; e.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { snake, food, score, best, status } = g.current;

  return (
    <>
      <Stack.Screen
        options={{
          title: '뱀 게임',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/')} style={{ paddingHorizontal: 8 }}>
              <Ionicons name="home-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowLeaderboard(true)}
              style={{ paddingHorizontal: 8 }}
            >
              <Text style={{ fontSize: 22 }}>🏆</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.screen, { paddingBottom: Math.max(insets.bottom, 24) }]}
        scrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>점수</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>최고</Text>
            <Text style={styles.scoreValue}>{best}</Text>
          </View>
        </View>

        <View
          style={[styles.board, { width: ACTUAL, height: ACTUAL }]}
          {...panResponder.panHandlers}
        >
          <View
            style={[styles.food, {
              width: CELL - 2, height: CELL - 2,
              left: food.x * CELL + 1, top: food.y * CELL + 1,
              borderRadius: (CELL - 2) / 2,
            }]}
          />
          {snake.map((seg, i) => (
            <View
              key={i}
              style={[styles.segment, {
                width: CELL - 2, height: CELL - 2,
                left: seg.x * CELL + 1, top: seg.y * CELL + 1,
                backgroundColor: i === 0 ? '#4ade80' : '#22c55e',
                borderRadius: i === 0 ? 4 : 2,
              }]}
            />
          ))}

          {status !== 'playing' && (
            <View style={styles.overlay}>
              {status === 'idle' ? (
                <>
                  <Text style={styles.overlayEmoji}>🐍</Text>
                  <Text style={styles.overlayTitle}>뱀 게임</Text>
                  <Text style={styles.overlayHint}>
                    {Platform.OS === 'web' ? '방향키 / 스페이스로 시작' : '탭하거나 스와이프로 시작'}
                  </Text>
                  <TouchableOpacity style={styles.startBtn} onPress={() => beginGame()}>
                    <Text style={styles.startBtnText}>시작</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.overlayEmoji}>💀</Text>
                  <Text style={styles.overlayTitle}>게임 오버</Text>
                  <Text style={styles.overlayScore}>{score}점</Text>
                  <TouchableOpacity style={styles.startBtn} onPress={() => beginGame()}>
                    <Text style={styles.startBtnText}>다시 시작</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.dpad}>
          <View style={styles.dpadRow}>
            <TouchableOpacity style={styles.dpadBtn} onPress={() => tryChangeDir(0, -1)}>
              <Ionicons name="chevron-up" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.dpadRow}>
            <TouchableOpacity style={styles.dpadBtn} onPress={() => tryChangeDir(-1, 0)}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={[styles.dpadBtn, styles.dpadCenter]} />
            <TouchableOpacity style={styles.dpadBtn} onPress={() => tryChangeDir(1, 0)}>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.dpadRow}>
            <TouchableOpacity style={styles.dpadBtn} onPress={() => tryChangeDir(0, 1)}>
              <Ionicons name="chevron-down" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* leaderboard modal */}
      <Modal
        visible={showLeaderboard}
        animationType="slide"
        onRequestClose={() => setShowLeaderboard(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>뱀 게임 랭킹</Text>
            <TouchableOpacity onPress={() => setShowLeaderboard(false)}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          <LeaderboardView
            gameType="snake"
            valueFormatter={(v) => `${v}점`}
            accentColor="#4ade80"
            isLoggedIn={isLoggedIn}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#121213',
    alignItems: 'center',
    paddingTop: 20,
    gap: 16,
  },
  scoreRow: { flexDirection: 'row', gap: 20 },
  scoreBox: {
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  scoreLabel: { color: '#818384', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  scoreValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  board: {
    backgroundColor: '#0d0d0e',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  food: { position: 'absolute', backgroundColor: '#f87171' },
  segment: { position: 'absolute' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,18,19,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  overlayEmoji: { fontSize: 48, marginBottom: 4 },
  overlayTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  overlayHint: { color: '#818384', fontSize: 13, marginBottom: 8 },
  overlayScore: { color: '#4ade80', fontSize: 40, fontWeight: 'bold', marginBottom: 4 },
  startBtn: {
    backgroundColor: '#4ade80',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  startBtnText: { color: '#121213', fontSize: 16, fontWeight: 'bold' },
  dpad: { gap: 4 },
  dpadRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dpadBtn: {
    width: 52,
    height: 52,
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadCenter: { backgroundColor: 'transparent', borderColor: 'transparent' },
  modalContainer: {
    flex: 1,
    backgroundColor: '#121213',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  modalTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
