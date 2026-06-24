import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SIZE = 5;
const GAP = 10;
const STORAGE_KEY = 'lights_out_progress';

interface Progress {
  maxLevel: number;
  bestMoves: Record<string, number>;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function applyToggle(grid: boolean[][], r: number, c: number): boolean[][] {
  const next = grid.map(row => [...row]);
  [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      next[nr][nc] = !next[nr][nc];
    }
  });
  return next;
}

function generatePuzzle(level: number): boolean[][] {
  const rand = seededRandom(level * 31337 + 42);
  let grid: boolean[][] = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));
  const taps = Math.min(3 + Math.floor(level * 1.5), 22);
  for (let i = 0; i < taps; i++) {
    const r = Math.floor(rand() * SIZE);
    const c = Math.floor(rand() * SIZE);
    grid = applyToggle(grid, r, c);
  }
  // 혹시 처음부터 전부 꺼진 상태면 가운데 하나 켜기
  if (grid.every(row => row.every(cell => !cell))) {
    grid = applyToggle(grid, 2, 2);
  }
  return grid;
}

export default function LightsOutScreen() {
  const { width: rawWidth } = useWindowDimensions();
  const width = rawWidth || 375;
  const insets = useSafeAreaInsets();

  const cellSize = Math.min(Math.floor((width - 48 - GAP * (SIZE - 1)) / SIZE), 80);

  const [level, setLevel] = useState(1);
  const [grid, setGrid] = useState<boolean[][]>(() => generatePuzzle(1));
  const [moves, setMoves] = useState(0);
  const [progress, setProgress] = useState<Progress>({ maxLevel: 1, bestMoves: {} });
  const [showClear, setShowClear] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v) setProgress(JSON.parse(v));
    });
  }, []);

  const saveProgress = useCallback(async (p: Progress) => {
    setProgress(p);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, []);

  const loadLevel = useCallback((lv: number) => {
    setLevel(lv);
    setGrid(generatePuzzle(lv));
    setMoves(0);
    setShowClear(false);
    setShowLevelSelect(false);
  }, []);

  const handleTap = useCallback((r: number, c: number) => {
    if (showClear) return;
    const next = applyToggle(grid, r, c);
    const nextMoves = moves + 1;
    setGrid(next);
    setMoves(nextMoves);

    if (next.every(row => row.every(cell => !cell))) {
      const key = String(level);
      const prevBest = progress.bestMoves[key];
      const newBest = prevBest === undefined || nextMoves < prevBest ? nextMoves : prevBest;
      const newProgress: Progress = {
        maxLevel: Math.max(progress.maxLevel, level + 1),
        bestMoves: { ...progress.bestMoves, [key]: newBest },
      };
      saveProgress(newProgress);
      setShowClear(true);
    }
  }, [grid, moves, showClear, level, progress, saveProgress]);

  const best = progress.bestMoves[String(level)];
  const onCount = grid.flat().filter(Boolean).length;

  return (
    <>
      <Stack.Screen options={{ title: '라이트 아웃', headerBackTitle: '홈' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}

      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.levelBadge} onPress={() => setShowLevelSelect(true)} activeOpacity={0.7}>
            <Text style={styles.levelText}>Lv.{level}</Text>
            <Text style={styles.levelArrow}> ▼</Text>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>이동</Text>
              <Text style={styles.statValue}>{moves}</Text>
            </View>
            {best !== undefined && (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>최고</Text>
                <Text style={styles.statValue}>{best}</Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>켜진 칸</Text>
              <Text style={[styles.statValue, onCount === 0 && { color: '#4CAF50' }]}>{onCount}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.resetBtn} onPress={() => loadLevel(level)} activeOpacity={0.7}>
            <Text style={styles.resetText}>↺</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>탭하면 해당 칸과 상하좌우가 켜짐/꺼짐 — 모두 꺼야 클리어!</Text>

        {/* 그리드 */}
        <View style={[styles.grid, { gap: GAP }]}>
          {grid.map((row, r) => (
            <View key={r} style={[styles.row, { gap: GAP }]}>
              {row.map((on, c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.cell,
                    { width: cellSize, height: cellSize, borderRadius: cellSize * 0.15 },
                    on ? styles.cellOn : styles.cellOff,
                  ]}
                  onPress={() => handleTap(r, c)}
                  activeOpacity={0.75}
                />
              ))}
            </View>
          ))}
        </View>

        {/* 클리어 모달 */}
        <Modal visible={showClear} transparent animationType="fade">
          <View style={styles.modalBg}>
            <View style={styles.modalBox}>
              <Text style={styles.modalEmoji}>🎉</Text>
              <Text style={styles.modalTitle}>클리어!</Text>
              <Text style={styles.modalSub}>{moves}번 만에 해결했어요</Text>
              {best !== undefined && (
                <Text style={styles.modalBest}>⭐ 최고 기록: {best}회</Text>
              )}
              <TouchableOpacity style={styles.primaryBtn} onPress={() => loadLevel(level + 1)} activeOpacity={0.8}>
                <Text style={styles.primaryBtnText}>다음 레벨 →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => loadLevel(level)} activeOpacity={0.8}>
                <Text style={styles.secondaryBtnText}>다시 하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 레벨 선택 모달 */}
        <Modal visible={showLevelSelect} transparent animationType="slide">
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowLevelSelect(false)}>
            <View style={[styles.modalBox, { maxHeight: 420 }]}>
              <Text style={styles.modalTitle}>레벨 선택</Text>
              <Text style={styles.modalSub}>해금된 레벨: {progress.maxLevel}개</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
                <View style={styles.levelGrid}>
                  {Array.from({ length: progress.maxLevel }, (_, i) => i + 1).map(lv => {
                    const lvBest = progress.bestMoves[String(lv)];
                    return (
                      <TouchableOpacity
                        key={lv}
                        style={[styles.lvBtn, lv === level && styles.lvBtnActive]}
                        onPress={() => loadLevel(lv)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.lvBtnNum, lv === level && styles.lvBtnNumActive]}>{lv}</Text>
                        {lvBest !== undefined && (
                          <Text style={styles.lvBtnBest}>★{lvBest}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
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
    paddingTop: 32,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  levelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  levelArrow: {
    color: '#818384',
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#818384',
    fontSize: 11,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resetBtn: {
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    color: '#fff',
    fontSize: 18,
  },
  hint: {
    color: '#818384',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 18,
  },
  grid: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderWidth: 2,
  },
  cellOn: {
    backgroundColor: '#FFB800',
    borderColor: '#FFC933',
    boxShadow: '0 0 12px #FFB800',
  } as any,
  cellOff: {
    backgroundColor: '#1A1A1B',
    borderColor: '#2C2C2E',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#1A1A1B',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  modalEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSub: {
    color: '#818384',
    fontSize: 15,
    marginBottom: 4,
  },
  modalBest: {
    color: '#FFB800',
    fontSize: 14,
    marginBottom: 20,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: {
    color: '#818384',
    fontSize: 15,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  lvBtn: {
    width: 56,
    height: 56,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  lvBtnActive: {
    borderColor: '#FFB800',
    backgroundColor: '#2A2200',
  },
  lvBtnNum: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lvBtnNumActive: {
    color: '#FFB800',
  },
  lvBtnBest: {
    color: '#FFB800',
    fontSize: 10,
    marginTop: 2,
  },
});
