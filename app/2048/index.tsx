import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder, Dimensions, Animated, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { load2048Stats, update2048Stats, Game2048Stats } from '../../utils/2048Storage';
import InfoModal from '../../components/InfoModal';
import LeaderboardView from '../../components/LeaderboardView';

// ── 타입 ──────────────────────────────────────────────────────────────────────
type Direction = 'up' | 'down' | 'left' | 'right';
type GameStatus = 'playing' | 'won' | 'over';
type Tab = 'game' | 'ranking';

const ACCENT_2048 = '#f59563';

interface TileData {
  id: number;
  value: number;
  row: number;
  col: number;
  merging?: boolean; // 합쳐져서 사라질 타일
}

// ── 상수 ──────────────────────────────────────────────────────────────────────
const SIZE = 4;
const SWIPE_THRESHOLD = 30;
const SLIDE_DURATION = 110;
const POP_DURATION = 80;

const { width: SCREEN_W } = Dimensions.get('window');
const BOARD_SIZE = Math.min(SCREEN_W - 32, 360);
const GAP = 8;
const TILE_SIZE = (BOARD_SIZE - GAP * (SIZE + 1)) / SIZE;

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

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────
function tileX(col: number) { return GAP + col * (TILE_SIZE + GAP); }
function tileY(row: number) { return GAP + row * (TILE_SIZE + GAP); }
function getTileFontSize(val: number) { return val >= 1024 ? 20 : val >= 128 ? 24 : 28; }
function getTileStyle(val: number) { return TILE_COLORS[val] ?? { bg: '#3c3a32', text: '#f9f6f2' }; }

function tilesToGrid(tiles: TileData[]): number[][] {
  const g = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
  tiles.filter(t => !t.merging).forEach(t => { g[t.row][t.col] = t.value; });
  return g;
}

function canMove(tiles: TileData[]): boolean {
  const g = tilesToGrid(tiles);
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (g[r][c] === 0) return true;
      if (c + 1 < SIZE && g[r][c] === g[r][c + 1]) return true;
      if (r + 1 < SIZE && g[r][c] === g[r + 1][c]) return true;
    }
  return false;
}

function findEmptyPos(tiles: TileData[]): [number, number][] {
  const g = tilesToGrid(tiles);
  const empties: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (g[r][c] === 0) empties.push([r, c]);
  return empties;
}

// ── 이동 로직 (타일 ID 추적) ───────────────────────────────────────────────────
interface MoveResult {
  newTiles: TileData[];       // 이동 후 모든 타일 (merging 포함)
  toRemove: Set<number>;      // 애니메이션 후 제거할 ID
  mergedIds: Set<number>;     // pop 애니메이션 재생할 ID
  score: number;
  moved: boolean;
}

function moveTiles(tiles: TileData[], dir: Direction): MoveResult {
  const nonMerging = tiles.filter(t => !t.merging);
  const result: TileData[] = [];
  const toRemove = new Set<number>();
  const mergedIds = new Set<number>();
  let score = 0;
  let moved = false;

  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const rowTiles = nonMerging
        .filter(t => t.row === r)
        .sort((a, b) => a.col - b.col);
      const reversed = dir === 'right' ? [...rowTiles].reverse() : rowTiles;

      let pos = 0;
      let i = 0;
      while (i < reversed.length) {
        const targetCol = dir === 'right' ? SIZE - 1 - pos : pos;
        if (i + 1 < reversed.length && reversed[i].value === reversed[i + 1].value) {
          const survivor = { ...reversed[i], value: reversed[i].value * 2, row: r, col: targetCol };
          const consumed = { ...reversed[i + 1], row: r, col: targetCol, merging: true };
          result.push(survivor, consumed);
          toRemove.add(consumed.id);
          mergedIds.add(survivor.id);
          score += survivor.value;
          if (reversed[i].col !== targetCol || reversed[i + 1].col !== targetCol) moved = true;
          i += 2;
        } else {
          const t = { ...reversed[i], row: r, col: targetCol };
          result.push(t);
          if (reversed[i].col !== targetCol) moved = true;
          i++;
        }
        pos++;
      }
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const colTiles = nonMerging
        .filter(t => t.col === c)
        .sort((a, b) => a.row - b.row);
      const reversed = dir === 'down' ? [...colTiles].reverse() : colTiles;

      let pos = 0;
      let i = 0;
      while (i < reversed.length) {
        const targetRow = dir === 'down' ? SIZE - 1 - pos : pos;
        if (i + 1 < reversed.length && reversed[i].value === reversed[i + 1].value) {
          const survivor = { ...reversed[i], value: reversed[i].value * 2, row: targetRow, col: c };
          const consumed = { ...reversed[i + 1], row: targetRow, col: c, merging: true };
          result.push(survivor, consumed);
          toRemove.add(consumed.id);
          mergedIds.add(survivor.id);
          score += survivor.value;
          if (reversed[i].row !== targetRow || reversed[i + 1].row !== targetRow) moved = true;
          i += 2;
        } else {
          const t = { ...reversed[i], row: targetRow, col: c };
          result.push(t);
          if (reversed[i].row !== targetRow) moved = true;
          i++;
        }
        pos++;
      }
    }
  }

  return { newTiles: result, toRemove, mergedIds, score, moved };
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function Game2048Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [wonAcknowledged, setWonAcknowledged] = useState(false);
  const [stats, setStats] = useState<Game2048Stats>({ totalGames: 0, bestScore: 0, bestTile: 0, distribution: Array(6).fill(0) });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [tab, setTab] = useState<Tab>('game');

  // 애니메이션 맵: id → { pos, scale }
  const animMap = useRef<Map<number, { pos: Animated.ValueXY; scale: Animated.Value }>>(new Map());
  const isAnimating = useRef(false);
  const idCounter = useRef(0);
  const scoreRef = useRef(0);
  const statusRef = useRef<GameStatus>('playing');

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    load2048Stats().then(s => { setStats(s); setBest(s.bestScore); });
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
  }, []);

  // ── 타일 생성 헬퍼 ────────────────────────────────────────────────────────
  const createTile = useCallback((value: number, row: number, col: number, appear = false): TileData => {
    const id = idCounter.current++;
    const pos = new Animated.ValueXY({ x: tileX(col), y: tileY(row) });
    const scale = new Animated.Value(appear ? 0 : 1);
    animMap.current.set(id, { pos, scale });
    return { id, value, row, col };
  }, []);

  // ── 초기 보드 ─────────────────────────────────────────────────────────────
  const newGame = useCallback(() => {
    animMap.current.clear();
    idCounter.current = 0;
    const empties: [number, number][] = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        empties.push([r, c]);

    const shuffle = [...empties].sort(() => Math.random() - 0.5);
    const t1 = createTile(Math.random() < 0.9 ? 2 : 4, shuffle[0][0], shuffle[0][1]);
    const t2 = createTile(Math.random() < 0.9 ? 2 : 4, shuffle[1][0], shuffle[1][1]);
    setTiles([t1, t2]);
    setScore(0);
    setStatus('playing');
    setWonAcknowledged(false);
  }, [createTile]);

  useEffect(() => { newGame(); }, []);

  // ── 이동 처리 ─────────────────────────────────────────────────────────────
  const handleMove = useCallback((dir: Direction) => {
    if (isAnimating.current) return;
    if (statusRef.current === 'over') return;
    if (statusRef.current === 'won' && !wonAcknowledged) return;

    setTiles(prev => {
      const { newTiles, toRemove, mergedIds, score: gained, moved } = moveTiles(prev, dir);
      if (!moved) return prev;

      isAnimating.current = true;

      // 슬라이드 애니메이션
      const slideAnims = newTiles.map(tile => {
        const anim = animMap.current.get(tile.id);
        if (!anim) return null;
        return Animated.timing(anim.pos, {
          toValue: { x: tileX(tile.col), y: tileY(tile.row) },
          duration: SLIDE_DURATION,
          useNativeDriver: true,
        });
      }).filter(Boolean) as Animated.CompositeAnimation[];

      Animated.parallel(slideAnims).start(() => {
        // 슬라이드 완료 → 소비 타일 제거 + pop + 새 타일
        toRemove.forEach(id => animMap.current.delete(id));

        // 합쳐진 타일 pop
        const popAnims = Array.from(mergedIds).map(id => {
          const anim = animMap.current.get(id);
          if (!anim) return null;
          return Animated.sequence([
            Animated.timing(anim.scale, { toValue: 1.2, duration: POP_DURATION, useNativeDriver: true }),
            Animated.timing(anim.scale, { toValue: 1.0, duration: POP_DURATION, useNativeDriver: true }),
          ]);
        }).filter(Boolean) as Animated.CompositeAnimation[];

        Animated.parallel(popAnims).start();

        // 새 타일 추가
        const surviving = newTiles.filter(t => !toRemove.has(t.id));
        const empties = findEmptyPos(surviving);
        let finalTiles = surviving;

        if (empties.length > 0) {
          const [nr, nc] = empties[Math.floor(Math.random() * empties.length)];
          const newTile = createTile(Math.random() < 0.9 ? 2 : 4, nr, nc, true);

          // 새 타일 등장 애니메이션
          const newAnim = animMap.current.get(newTile.id);
          if (newAnim) {
            Animated.spring(newAnim.scale, {
              toValue: 1,
              useNativeDriver: true,
              speed: 20,
              bounciness: 6,
            }).start();
          }

          finalTiles = [...surviving, newTile];
        }

        // 점수 업데이트
        const newScore = scoreRef.current + gained;
        setScore(newScore);
        setBest(b => Math.max(b, newScore));
        scoreRef.current = newScore;

        // 승리/게임오버 체크
        const topVal = Math.max(...finalTiles.map(t => t.value));
        if (topVal >= 2048 && statusRef.current === 'playing') {
          setStatus('won');
          statusRef.current = 'won';
          update2048Stats(newScore, topVal).then(setStats);
        } else if (!canMove(finalTiles)) {
          setStatus('over');
          statusRef.current = 'over';
          update2048Stats(newScore, topVal).then(setStats);
        }

        setTiles(finalTiles);
        isAnimating.current = false;
      });

      // 즉시 newTiles로 바꿔서 렌더링 (위치는 anim이 처리)
      return newTiles;
    });
  }, [wonAcknowledged, createTile]);

  // ── 스와이프 ──────────────────────────────────────────────────────────────
  const touchStart = useRef({ x: 0, y: 0 });
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => {
      touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    },
    onPanResponderRelease: e => {
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
            gameType="2048"
            ascending={false}
            valueFormatter={v => `${v.toLocaleString()}점`}
            subtitle="높을수록 좋아요"
            accentColor={ACCENT_2048}
            isLoggedIn={isLoggedIn}
          />
        </View>
      ) : (
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 점수 */}
        <View style={styles.scoreRow}>
          <ScoreBox label="점수" value={score} />
          <ScoreBox label="최고" value={best} />
          <TouchableOpacity style={styles.newGameBtn} onPress={newGame}>
            <Text style={styles.newGameText}>새 게임</Text>
          </TouchableOpacity>
        </View>

        {/* 보드 */}
        <View
          style={[styles.boardWrapper, { width: BOARD_SIZE, height: BOARD_SIZE }]}
          {...panResponder.panHandlers}
        >
          {/* 빈 셀 배경 */}
          {Array(SIZE).fill(null).map((_, r) =>
            Array(SIZE).fill(null).map((_, c) => (
              <View
                key={`bg-${r}-${c}`}
                style={[styles.cellBg, {
                  width: TILE_SIZE, height: TILE_SIZE,
                  left: tileX(c), top: tileY(r),
                }]}
              />
            ))
          )}

          {/* 타일 (Animated) */}
          {tiles.map(tile => {
            const anim = animMap.current.get(tile.id);
            const { bg, text } = getTileStyle(tile.value);
            if (!anim) return null;
            return (
              <Animated.View
                key={tile.id}
                style={[
                  styles.tile,
                  {
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    backgroundColor: bg,
                    transform: [
                      { translateX: anim.pos.x },
                      { translateY: anim.pos.y },
                      { scale: anim.scale },
                    ],
                  },
                ]}
              >
                <Text style={[styles.tileText, { color: text, fontSize: getTileFontSize(tile.value) }]}>
                  {tile.value}
                </Text>
              </Animated.View>
            );
          })}

          {/* 오버레이 */}
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

        {/* 방향 버튼 */}
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
      </ScrollView>
)}
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
    borderBottomColor: ACCENT_2048,
  },
  tabText: {
    color: '#818384',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: ACCENT_2048,
  },
  rankingContainer: {
    flex: 1,
    backgroundColor: '#121213',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#faf8ef',
  },
  container: {
    flexGrow: 1,
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
    top: 0,
    left: 0,
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
  overlayEmoji: { fontSize: 48 },
  overlayTitle: { color: '#776e65', fontSize: 28, fontWeight: 'bold' },
  overlayScore: { color: '#776e65', fontSize: 16, marginBottom: 8 },
  overlayBtn: {
    backgroundColor: '#8f7a66',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  overlayBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  dpadWrapper: {
    marginTop: 24,
    alignItems: 'center',
    gap: 4,
  },
  dpadRow: { flexDirection: 'row', gap: 4 },
  dpadBtn: {
    backgroundColor: '#bbada0',
    width: 52, height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dpadText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  guestNote: { color: '#bbada0', fontSize: 12, marginTop: 16 },
});
