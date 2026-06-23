import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, PanResponder, Platform, Modal, ScrollView,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { loadTetrisBest, recordTetrisGame } from '../../utils/tetrisStorage';
import LeaderboardView from '../../components/LeaderboardView';

const COLS = 10;
const ROWS = 20;

// [row, col] offsets from bounding box top-left, per rotation state
const TETROMINOES = [
  { color: '#00f0f0', size: 4, rotations: [ // I
    [[1,0],[1,1],[1,2],[1,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,1],[1,1],[2,1],[3,1]],
  ]},
  { color: '#f0f000', size: 2, rotations: [ // O
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
  ]},
  { color: '#a000f0', size: 3, rotations: [ // T
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[2,1]],
  ]},
  { color: '#00f000', size: 3, rotations: [ // S
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,1],[1,2],[2,0],[2,1]],
    [[0,0],[1,0],[1,1],[2,1]],
  ]},
  { color: '#f00000', size: 3, rotations: [ // Z
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,2],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[0,1],[1,0],[1,1],[2,0]],
  ]},
  { color: '#0080f0', size: 3, rotations: [ // J
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[1,0],[2,0]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,0],[2,1]],
  ]},
  { color: '#f0a000', size: 3, rotations: [ // L
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,0],[1,0],[2,0],[2,1]],
    [[1,0],[1,1],[1,2],[2,0]],
    [[0,0],[0,1],[1,1],[2,1]],
  ]},
];

const LINE_SCORES = [0, 100, 300, 500, 800];

type Cell = string | null;
type Board = Cell[][];

interface Piece {
  type: number;
  rotation: number;
  row: number;
  col: number;
}

type Status = 'idle' | 'playing' | 'gameover';

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function getCells(piece: Piece): [number, number][] {
  return TETROMINOES[piece.type].rotations[piece.rotation].map(
    ([r, c]) => [r + piece.row, c + piece.col] as [number, number]
  );
}

function isValid(board: Board, piece: Piece): boolean {
  return getCells(piece).every(([r, c]) =>
    c >= 0 && c < COLS && r < ROWS && (r < 0 || board[r][c] === null)
  );
}

function spawnPiece(type: number): Piece {
  const def = TETROMINOES[type];
  const col = Math.floor((COLS - def.size) / 2);
  // I piece bounding box row 1 = actual cells, spawn 2 above; others spawn 1 above
  const row = type === 0 ? -2 : -1;
  return { type, rotation: 0, row, col };
}

function clearLines(board: Board): number {
  let count = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell !== null)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      count++;
      r++; // recheck same index
    }
  }
  return count;
}

function computeGhostRow(board: Board, piece: Piece): number {
  let p = { ...piece };
  while (isValid(board, { ...p, row: p.row + 1 })) p.row++;
  return p.row;
}

function getTickMs(level: number): number {
  return Math.max(80, 800 - (level - 1) * 72);
}

function randType(): number {
  return Math.floor(Math.random() * 7);
}

export default function TetrisScreen() {
  const { width: rawWidth } = useWindowDimensions();
  const width = rawWidth || 375;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const CELL = Math.min(Math.floor((width - 32) / COLS), 30);
  const BOARD_W = CELL * COLS;
  const BOARD_H = CELL * ROWS;

  const g = useRef({
    board: emptyBoard(),
    piece: null as Piece | null,
    nextType: randType(),
    score: 0,
    best: 0,
    lines: 0,
    level: 1,
    status: 'idle' as Status,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockMovesRef = useRef(0);
  const cellRef = useRef(CELL);
  cellRef.current = CELL; // keep fresh for panResponder closure
  const dragStartColRef = useRef(0);
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate(n => n + 1);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    loadTetrisBest().then(best => { g.current.best = best; rerender(); });
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      subscription.unsubscribe();
    };
  }, []);

  function scheduleTick() {
    const s = g.current;
    if (s.status !== 'playing') return;
    timerRef.current = setTimeout(() => {
      tick();
      scheduleTick();
    }, getTickMs(s.level));
  }

  const LOCK_DELAY_MS = 400;
  const MAX_LOCK_MOVES = 15;

  function startLockDelay() {
    if (lockTimerRef.current) return; // already counting
    lockMovesRef.current = 0;
    lockTimerRef.current = setTimeout(() => {
      lockTimerRef.current = null;
      lockPiece();
      rerender();
    }, LOCK_DELAY_MS);
  }

  function resetLockDelay() {
    if (!lockTimerRef.current) return;
    if (lockMovesRef.current >= MAX_LOCK_MOVES) return;
    lockMovesRef.current++;
    clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => {
      lockTimerRef.current = null;
      lockPiece();
      rerender();
    }, LOCK_DELAY_MS);
  }

  function tick() {
    const s = g.current;
    if (s.status !== 'playing' || !s.piece) return;
    const moved = { ...s.piece, row: s.piece.row + 1 };
    if (isValid(s.board, moved)) {
      s.piece = moved;
      // piece fell — cancel lock delay (it's airborne again)
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
        lockMovesRef.current = 0;
      }
    } else {
      // piece touched bottom — start lock delay instead of locking immediately
      startLockDelay();
    }
    rerender();
  }

  function lockPiece() {
    const s = g.current;
    if (!s.piece) return;
    if (lockTimerRef.current) { clearTimeout(lockTimerRef.current); lockTimerRef.current = null; }
    lockMovesRef.current = 0;
    const color = TETROMINOES[s.piece.type].color;
    const lockedCells = getCells(s.piece);
    const topOut = lockedCells.every(([r]) => r < 0);

    for (const [r, c] of lockedCells) {
      if (r >= 0 && r < ROWS) s.board[r][c] = color;
    }

    const cleared = clearLines(s.board);
    s.lines += cleared;
    s.level = Math.floor(s.lines / 10) + 1;
    if (cleared > 0) s.score += LINE_SCORES[cleared] * s.level;

    const next = spawnPiece(s.nextType);
    s.nextType = randType();

    if (topOut || !isValid(s.board, next)) {
      s.status = 'gameover';
      if (s.score > s.best) s.best = s.score;
      recordTetrisGame(s.score);
      if (timerRef.current) clearTimeout(timerRef.current);
      s.piece = null;
    } else {
      s.piece = next;
    }
  }

  function startGame() {
    const s = g.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (lockTimerRef.current) { clearTimeout(lockTimerRef.current); lockTimerRef.current = null; }
    lockMovesRef.current = 0;
    s.board = emptyBoard();
    s.nextType = randType();
    s.piece = spawnPiece(randType());
    s.score = 0;
    s.lines = 0;
    s.level = 1;
    s.status = 'playing';
    rerender();
    scheduleTick();
  }

  function doMove(dc: number) {
    const s = g.current;
    if (s.status !== 'playing' || !s.piece) return;
    const moved = { ...s.piece, col: s.piece.col + dc };
    if (isValid(s.board, moved)) {
      s.piece = moved;
      resetLockDelay(); // give extra time if on the ground
      rerender();
    }
  }

  function doRotate(dir: 1 | -1 = 1) {
    const s = g.current;
    if (s.status !== 'playing' || !s.piece) return;
    const newRot = (s.piece.rotation + dir + 4) % 4;
    const base = { ...s.piece, rotation: newRot };
    // Wall kick offsets to try (includes floor kick [-1,0])
    const kicks: [number, number][] = [[0,0],[0,-1],[0,1],[0,-2],[0,2],[-1,0]];
    for (const [dr, dc] of kicks) {
      const kicked = { ...base, row: base.row + dr, col: base.col + dc };
      if (isValid(s.board, kicked)) {
        s.piece = kicked;
        resetLockDelay(); // give extra time on successful rotation
        rerender();
        return;
      }
    }
  }

  function doSoftDrop() {
    const s = g.current;
    if (s.status !== 'playing' || !s.piece) return;
    const moved = { ...s.piece, row: s.piece.row + 1 };
    if (isValid(s.board, moved)) {
      s.piece = moved;
      s.score += 1;
      rerender();
    } else {
      lockPiece();
      rerender();
    }
  }

  function doHardDrop() {
    const s = g.current;
    if (s.status !== 'playing' || !s.piece) return;
    const ghostRow = computeGhostRow(s.board, s.piece);
    const dropped = ghostRow - s.piece.row;
    s.score += dropped * 2;
    s.piece = { ...s.piece, row: ghostRow };
    lockPiece();
    rerender();
  }

  // Keyboard controls (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      const s = g.current;
      if (e.key === 'Enter' || e.code === 'Space') {
        if (s.status !== 'playing') { startGame(); e.preventDefault(); return; }
        if (e.code === 'Space') { doHardDrop(); e.preventDefault(); return; }
      }
      if (s.status !== 'playing') return;
      if (e.key === 'ArrowLeft')  { doMove(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { doMove(1);  e.preventDefault(); }
      else if (e.key === 'ArrowDown')  { doSoftDrop(); e.preventDefault(); }
      else if (e.key === 'ArrowUp')    { doRotate(1); e.preventDefault(); }
      else if (e.key === 'z' || e.key === 'Z') { doRotate(-1); e.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Drag to move left/right, tap to rotate, swipe down to hard drop
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      dragStartColRef.current = g.current.piece?.col ?? 0;
    },
    onPanResponderMove: (_, { dx, dy }) => {
      const s = g.current;
      if (s.status !== 'playing' || !s.piece) return;
      // ignore if mostly vertical (downward flick)
      if (Math.abs(dy) > Math.abs(dx) + 20) return;
      const cellsMoved = Math.round(dx / cellRef.current);
      const targetCol = dragStartColRef.current + cellsMoved;
      if (targetCol === s.piece.col) return;
      // step toward target, respecting walls and other pieces
      const dir = targetCol > s.piece.col ? 1 : -1;
      let p = { ...s.piece };
      while (p.col !== targetCol) {
        const next = { ...p, col: p.col + dir };
        if (!isValid(s.board, next)) break;
        p = next;
      }
      if (p.col !== s.piece.col) { s.piece = p; rerender(); }
    },
    onPanResponderRelease: (_, { dx, dy }) => {
      const s = g.current;
      if (s.status !== 'playing') { startGame(); return; }
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx < 10 && ady < 10) {
        doRotate(1);           // tap = rotate
      } else if (ady > adx && dy > 20) {
        doHardDrop();          // swipe down = hard drop
      } else if (ady > adx && dy < -20) {
        doRotate(1);           // swipe up = rotate
      }
      // horizontal drag: piece already positioned by onPanResponderMove
    },
  })).current;

  // Build display board merging locked + ghost + active
  const s = g.current;
  const display: (string | null)[][] = s.board.map(row => [...row]);
  if (s.piece) {
    const ghostRow = computeGhostRow(s.board, s.piece);
    const ghostPiece = { ...s.piece, row: ghostRow };
    const color = TETROMINOES[s.piece.type].color;
    for (const [r, c] of getCells(ghostPiece)) {
      if (r >= 0 && r < ROWS && !display[r][c]) display[r][c] = color + '40'; // hex alpha 25%
    }
    for (const [r, c] of getCells(s.piece)) {
      if (r >= 0 && r < ROWS) display[r][c] = color;
    }
  }

  // Next piece preview (4×4 grid, PREVIEW_CELL px each)
  const PREVIEW_CELL = 14;
  const nextDef = TETROMINOES[s.nextType];
  const nextGrid: boolean[][] = Array.from({ length: 4 }, () => Array(4).fill(false));
  const offset = Math.floor((4 - nextDef.size) / 2);
  for (const [r, c] of nextDef.rotations[0]) {
    const gr = r + offset, gc = c + offset;
    if (gr >= 0 && gr < 4 && gc >= 0 && gc < 4) nextGrid[gr][gc] = true;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '테트리스',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/')} style={{ paddingHorizontal: 8 }}>
              <Ionicons name="home-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowLeaderboard(true)} style={{ paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 22 }}>🏆</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.screen, { paddingBottom: Math.max(insets.bottom, 24) }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>점수</Text>
            <Text style={styles.infoValue}>{s.score}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>최고</Text>
            <Text style={styles.infoValue}>{s.best}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>레벨</Text>
            <Text style={styles.infoValue}>{s.level}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>라인</Text>
            <Text style={styles.infoValue}>{s.lines}</Text>
          </View>
          <View style={styles.nextBox}>
            <Text style={styles.infoLabel}>NEXT</Text>
            <View style={{ width: 4 * PREVIEW_CELL, height: 4 * PREVIEW_CELL }}>
              {nextGrid.map((row, r) => (
                <View key={r} style={{ flexDirection: 'row', height: PREVIEW_CELL }}>
                  {row.map((filled, c) => (
                    <View
                      key={c}
                      style={{
                        width: PREVIEW_CELL,
                        height: PREVIEW_CELL,
                        backgroundColor: filled ? nextDef.color : 'transparent',
                        borderRadius: 2,
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Board */}
        <View
          style={[styles.board, { width: BOARD_W, height: BOARD_H }]}
          {...panResponder.panHandlers}
        >
          {display.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row', height: CELL }}>
              {row.map((cell, c) => (
                <View
                  key={c}
                  style={[
                    styles.cell,
                    { width: CELL, height: CELL },
                    cell ? { backgroundColor: cell, borderColor: 'rgba(255,255,255,0.15)' } : null,
                  ]}
                />
              ))}
            </View>
          ))}

          {s.status !== 'playing' && (
            <View style={styles.overlay}>
              {s.status === 'idle' ? (
                <>
                  <Text style={styles.overlayEmoji}>🧱</Text>
                  <Text style={styles.overlayTitle}>테트리스</Text>
                  <Text style={styles.overlayHint}>
                    {Platform.OS === 'web'
                      ? '방향키: 이동/회전  Space: 하드드롭'
                      : '탭: 회전  스와이프: 이동/드롭'}
                  </Text>
                  <TouchableOpacity style={styles.startBtn} onPress={startGame}>
                    <Text style={styles.startBtnText}>시작</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.overlayEmoji}>💀</Text>
                  <Text style={styles.overlayTitle}>게임 오버</Text>
                  <Text style={styles.overlayScore}>{s.score}점</Text>
                  <TouchableOpacity style={styles.startBtn} onPress={startGame}>
                    <Text style={styles.startBtnText}>다시 시작</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => doMove(-1)}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => doRotate(1)}>
              <Ionicons name="refresh" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => doMove(1)}>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={doSoftDrop}>
              <Ionicons name="chevron-down" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlBtn, styles.hardDropBtn]} onPress={doHardDrop}>
              <Ionicons name="arrow-down" size={22} color="#121213" />
              <Ionicons name="arrow-down" size={22} color="#121213" style={{ marginTop: -14 }} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showLeaderboard} animationType="slide" onRequestClose={() => setShowLeaderboard(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>테트리스 랭킹</Text>
            <TouchableOpacity onPress={() => setShowLeaderboard(false)}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          <LeaderboardView
            gameType="tetris"
            valueFormatter={(v) => `${v}점`}
            accentColor="#a000f0"
            isLoggedIn={isLoggedIn}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: '#121213',
    alignItems: 'center',
    paddingTop: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  infoBlock: {
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 54,
  },
  infoLabel: { color: '#818384', fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },
  infoValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  nextBox: {
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 4,
  },
  board: {
    backgroundColor: '#0d0d0e',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  cell: {
    borderWidth: 0.5,
    borderColor: '#1a1a1b',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,14,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  overlayEmoji: { fontSize: 48, marginBottom: 4 },
  overlayTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  overlayHint: { color: '#818384', fontSize: 12, textAlign: 'center', paddingHorizontal: 24, marginBottom: 8 },
  overlayScore: { color: '#a000f0', fontSize: 40, fontWeight: 'bold', marginBottom: 4 },
  startBtn: {
    backgroundColor: '#a000f0',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  controls: { gap: 6, alignItems: 'center' },
  controlRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  ctrlBtn: {
    width: 56,
    height: 56,
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hardDropBtn: {
    width: 80,
    backgroundColor: '#a000f0',
    borderColor: '#a000f0',
    overflow: 'hidden',
  },
  modalContainer: { flex: 1, backgroundColor: '#121213' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  modalTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
