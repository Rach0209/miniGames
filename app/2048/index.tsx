import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder, Dimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { load2048Stats, update2048Stats, Game2048Stats } from '../../utils/2048Storage';
import InfoModal from '../../components/InfoModal';

// ── 타입 ──────────────────────────────────────────────────────────────────────
type Board = number[][];
type Direction = 'up' | 'down' | 'left' | 'right';
type GameStatus = 'playing' | 'won' | 'over';

// ── 상수 ──────────────────────────────────────────────────────────────────────
const SIZE = 4;
const SWIPE_THRESHOLD = 30;

const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  0:    { bg: '#cdc1b4', text: 'transparent' },
  2:    { bg: '#eee4da', text: '#776e65' },
  4:    { bg: '#ede0c8', text: '#776e65' },
  8:    { bg: '#f2b179', text: '#f9f6f2' },
  16:   { bg: '#f59563', text: '#f9f6f2' },
  32:   { bg: '#f67c5f', text: '#f9f6f2' },
  64:   { bg: '#f65e3b', text: '#f9f6f2' },
  128:  { bg: '#edcf72', text: '#f9f6f2' },
  256:  { bg: '#edcc61', text: '#f9f6f2' },
  512:  { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
};

const RULES_2048 = [
  { emoji: '👆', text: '스와이프(또는 방향 버튼)로 모든 타일을 같은 방향으로 밀어요.' },
  { emoji: '🔢', text: '같은 숫자 타일 두 개가 부딪히면 합쳐져 두 배 숫자가 돼요.' },
  { emoji: '🏆', text: '2048 타일을 만들면 승리!' },
  { emoji: '➕', text: '이동할 때마다 빈 칸에 2 또는 4가 새로 생겨요.' },
  { emoji: '💀', text: '빈 칸도 없고 합칠 수 있는 타일도 없으면 게임오버.' },
  { emoji: '💾', text: '최고 점수는 Google 로그인 시 자동 저장돼요.' },
];

// ── 게임 로직 ─────────────────────────────────────────────────────────────────
function emptyBoard(): Board {
  return Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
}

function addRandomTile(board: Board): Board {
  const empties: [number, number][] = [];
  board.forEach((row, r) => row.forEach((v, c) => { if (v === 0) empties.push([r, c]); }));
  if (empties.length === 0) return board;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const next = board.map(row => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideRow(row: number[]): { row: number[]; score: number } {
  const nums = row.filter(v => v !== 0);
  let score = 0;
  const merged: number[] = [];
  let i = 0;
  while (i < nums.length) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const val = nums[i] * 2;
      merged.push(val);
      score += val;
      i += 2;
    } else {
      merged.push(nums[i]);
      i++;
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { row: merged, score };
}

function moveBoard(board: Board, dir: Direction): { board: Board; score: number; moved: boolean } {
  let totalScore = 0;
  let moved = false;
  const next = emptyBoard();

  const getRow = (b: Board, r: number) => b[r];
  const getCol = (b: Board, c: number) => b.map(row => row[c]);

  if (dir === 'left') {
    for (let r = 0; r < SIZE; r++) {
      const { row, score } = slideRow(getRow(board, r));
      next[r] = row;
      totalScore += score;
      if (row.join() !== getRow(board, r).join()) moved = true;
    }
  } else if (dir === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const { row, score } = slideRow([...getRow(board, r)].reverse());
      next[r] = row.reverse();
      totalScore += score;
      if (next[r].join() !== getRow(board, r).join()) moved = true;
    }
  } else if (dir === 'up') {
    for (let c = 0; c < SIZE; c++) {
      const { row, score } = slideRow(getCol(board, c));
      row.forEach((v, r) => { next[r][c] = v; });
      totalScore += score;
      if (row.join() !== getCol(board, c).join()) moved = true;
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const { row, score } = slideRow([...getCol(board, c)].reverse());
      row.reverse().forEach((v, r) => { next[r][c] = v; });
      totalScore += score;
      if (next.map(row => row[c]).join() !== getCol(board, c).join()) moved = true;
    }
  }

  return { board: next, score: totalScore, moved };
}

function maxTile(board: Board): number {
  return Math.max(...board.flat());
}

function canMove(board: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return true;
      if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return true;
      if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

function initBoard(): Board {
  return addRandomTile(addRandomTile(emptyBoard()));
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const BOARD_SIZE = Math.min(SCREEN_W - 32, 360);
const GAP = 8;
const TILE_SIZE = (BOARD_SIZE - GAP * (SIZE + 1)) / SIZE;

export default function Game2048Screen() {
  const router = useRouter();
  const [board, setBoard] = useState<Board>(initBoard);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [stats, setStats] = useState<Game2048Stats>({ totalGames: 0, bestScore: 0, bestTile: 0, distribution: Array(6).fill(0) });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [wonAcknowledged, setWonAcknowledged] = useState(false);

  useEffect(() => {
    load2048Stats().then(s => { setStats(s); setBest(s.bestScore); });
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
  }, []);

  const handleMove = useCallback((dir: Direction) => {
    if (status === 'over') return;
    if (status === 'won' && !wonAcknowledged) return;

    setBoard(prev => {
      const { board: next, score: gained, moved } = moveBoard(prev, dir);
      if (!moved) return prev;

      const withTile = addRandomTile(next);
      const top = maxTile(withTile);

      setScore(s => {
        const newScore = s + gained;
        setBest(b => Math.max(b, newScore));
        return newScore;
      });

      if (top >= 2048 && status === 'playing') {
        setStatus('won');
        setScore(s => {
          update2048Stats(s + gained, top).then(setStats);
          return s + gained;
        });
      } else if (!canMove(withTile)) {
        setStatus('over');
        setScore(s => {
          update2048Stats(s + gained, top).then(setStats);
          return s + gained;
        });
      }

      return withTile;
    });
  }, [status, wonAcknowledged]);

  const newGame = useCallback(() => {
    setBoard(initBoard());
    setScore(0);
    setStatus('playing');
    setWonAcknowledged(false);
  }, []);

  // 스와이프 처리
  const touchStart = useRef({ x: 0, y: 0 });
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    },
    onPanResponderRelease: (e) => {
      const dx = e.nativeEvent.pageX - touchStart.current.x;
      const dy = e.nativeEvent.pageY - touchStart.current.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        handleMove(dx > 0 ? 'right' : 'left');
      } else {
        handleMove(dy > 0 ? 'down' : 'up');
      }
    },
  })).current;

  // 타일 색상 (정의된 범위 밖은 가장 짙은 색으로)
  const getTileStyle = (val: number) => TILE_COLORS[val] ?? { bg: '#3c3a32', text: '#f9f6f2' };
  const getTileFontSize = (val: number) => val >= 1024 ? 20 : val >= 128 ? 24 : 28;

  return (
    <>
      <Stack.Screen
        options={{
          title: '2048',
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
        title="2048"
        description="타일을 밀어 같은 숫자를 합쳐 2048을 만드세요!"
        rules={RULES_2048}
      />

      <View style={styles.container}>
        {/* 점수 */}
        <View style={styles.scoreRow}>
          <ScoreBox label="점수" value={score} />
          <ScoreBox label="최고" value={best} />
          <TouchableOpacity style={styles.newGameBtn} onPress={newGame}>
            <Text style={styles.newGameText}>새 게임</Text>
          </TouchableOpacity>
        </View>

        {/* 보드 */}
        <View style={[styles.boardWrapper, { width: BOARD_SIZE, height: BOARD_SIZE }]}
          {...panResponder.panHandlers}
        >
          {/* 빈 셀 배경 */}
          {Array(SIZE).fill(null).map((_, r) =>
            Array(SIZE).fill(null).map((_, c) => (
              <View
                key={`bg-${r}-${c}`}
                style={[styles.cellBg, {
                  width: TILE_SIZE, height: TILE_SIZE,
                  left: GAP + c * (TILE_SIZE + GAP),
                  top: GAP + r * (TILE_SIZE + GAP),
                }]}
              />
            ))
          )}

          {/* 타일 */}
          {board.map((row, r) =>
            row.map((val, c) => {
              const { bg, text } = getTileStyle(val);
              return (
                <View
                  key={`tile-${r}-${c}`}
                  style={[styles.tile, {
                    width: TILE_SIZE, height: TILE_SIZE,
                    left: GAP + c * (TILE_SIZE + GAP),
                    top: GAP + r * (TILE_SIZE + GAP),
                    backgroundColor: bg,
                  }]}
                >
                  {val > 0 && (
                    <Text style={[styles.tileText, { color: text, fontSize: getTileFontSize(val) }]}>
                      {val}
                    </Text>
                  )}
                </View>
              );
            })
          )}

          {/* 게임오버 / 승리 오버레이 */}
          {(status === 'over' || (status === 'won' && !wonAcknowledged)) && (
            <View style={styles.overlay}>
              <Text style={styles.overlayEmoji}>{status === 'won' ? '🎉' : '😢'}</Text>
              <Text style={styles.overlayTitle}>{status === 'won' ? '2048 달성!' : '게임오버'}</Text>
              <Text style={styles.overlayScore}>점수: {score}</Text>
              {status === 'won' && (
                <TouchableOpacity style={styles.overlayBtn} onPress={() => setWonAcknowledged(true)}>
                  <Text style={styles.overlayBtnText}>계속하기</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.overlayBtn, { marginTop: 8 }]} onPress={newGame}>
                <Text style={styles.overlayBtnText}>새 게임</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 방향 버튼 (웹/접근성용) */}
        <View style={styles.dpadWrapper}>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove('up')}>
            <Text style={styles.dpadText}>▲</Text>
          </TouchableOpacity>
          <View style={styles.dpadRow}>
            <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove('left')}>
              <Text style={styles.dpadText}>◀</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove('down')}>
              <Text style={styles.dpadText}>▼</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove('right')}>
              <Text style={styles.dpadText}>▶</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isLoggedIn && (
          <Text style={styles.guestNote}>🔒 로그인하면 최고 점수가 저장돼요</Text>
        )}
      </View>
    </>
  );
}

function ScoreBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.scoreBox}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8ef',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  scoreBox: {
    backgroundColor: '#bbada0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 80,
  },
  scoreLabel: {
    color: '#eee4da',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scoreValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  newGameBtn: {
    backgroundColor: '#8f7a66',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  newGameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  boardWrapper: {
    backgroundColor: '#bbada0',
    borderRadius: 8,
    position: 'relative',
  },
  cellBg: {
    position: 'absolute',
    backgroundColor: '#cdc1b4',
    borderRadius: 6,
  },
  tile: {
    position: 'absolute',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileText: {
    fontWeight: 'bold',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(238,228,218,0.85)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  overlayEmoji: {
    fontSize: 48,
  },
  overlayTitle: {
    color: '#776e65',
    fontSize: 28,
    fontWeight: 'bold',
  },
  overlayScore: {
    color: '#776e65',
    fontSize: 16,
    marginBottom: 8,
  },
  overlayBtn: {
    backgroundColor: '#8f7a66',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  overlayBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  dpadWrapper: {
    marginTop: 24,
    alignItems: 'center',
    gap: 4,
  },
  dpadRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dpadBtn: {
    backgroundColor: '#bbada0',
    width: 52,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dpadText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  guestNote: {
    color: '#bbada0',
    fontSize: 12,
    marginTop: 16,
  },
});
