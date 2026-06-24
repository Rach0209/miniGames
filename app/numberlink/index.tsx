import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 각 레벨: { size, endpoints }
// endpoints: [번호, r1, c1, r2, c2][]
type Endpoint = [number, number, number, number, number];
interface Level {
  size: number;
  endpoints: Endpoint[];
}

const LEVELS: Level[] = [
  // 레벨 1 — 5×5, 4쌍
  {
    size: 5,
    endpoints: [
      [1, 2, 3, 0, 4],
      [2, 3, 1, 0, 1],
      [3, 0, 2, 4, 0],
      [4, 4, 4, 3, 4],
    ],
  },
  // 레벨 2 — 5×5, 5쌍
  {
    size: 5,
    endpoints: [
      [1, 0, 0, 4, 0],
      [2, 2, 1, 0, 1],
      [3, 4, 3, 4, 4],
      [4, 2, 4, 4, 2],
      [5, 0, 3, 0, 4],
    ],
  },
  // 레벨 3 — 6×6, 5쌍
  {
    size: 6,
    endpoints: [
      [1, 0, 3, 2, 5],
      [2, 3, 0, 2, 0],
      [3, 2, 2, 2, 3],
      [4, 3, 5, 4, 4],
      [5, 5, 1, 5, 2],
    ],
  },
  // 레벨 4 — 6×6, 6쌍
  {
    size: 6,
    endpoints: [
      [1, 1, 2, 1, 1],
      [2, 5, 3, 4, 0],
      [3, 1, 5, 0, 5],
      [4, 0, 0, 3, 2],
      [5, 4, 5, 2, 4],
      [6, 5, 0, 5, 2],
    ],
  },
  // 레벨 5 — 7×7, 6쌍
  {
    size: 7,
    endpoints: [
      [1, 0, 4, 0, 0],
      [2, 3, 1, 4, 4],
      [3, 1, 2, 3, 2],
      [4, 5, 2, 5, 1],
      [5, 4, 6, 0, 5],
      [6, 6, 0, 1, 0],
    ],
  },
  // 레벨 6 — 7×7, 7쌍
  {
    size: 7,
    endpoints: [
      [1, 4, 5, 5, 5],
      [2, 6, 2, 6, 3],
      [3, 0, 1, 2, 4],
      [4, 3, 3, 3, 6],
      [5, 1, 4, 1, 5],
      [6, 5, 0, 2, 0],
      [7, 6, 6, 6, 0],
    ],
  },
  // 레벨 7 — 8×8, 7쌍
  {
    size: 8,
    endpoints: [
      [1, 4, 4, 0, 6],
      [2, 4, 0, 0, 3],
      [3, 6, 5, 3, 6],
      [4, 2, 5, 5, 5],
      [5, 1, 3, 1, 2],
      [6, 6, 1, 7, 2],
      [7, 7, 3, 5, 7],
    ],
  },
  // 레벨 8 — 8×8, 8쌍
  {
    size: 8,
    endpoints: [
      [1, 0, 1, 3, 4],
      [2, 1, 7, 0, 7],
      [3, 2, 3, 2, 2],
      [4, 6, 6, 4, 5],
      [5, 3, 5, 1, 5],
      [6, 0, 5, 0, 2],
      [7, 4, 7, 3, 7],
      [8, 4, 2, 6, 3],
    ],
  },
  // 레벨 9 — 9×9, 8쌍
  {
    size: 9,
    endpoints: [
      [1, 7, 6, 7, 4],
      [2, 3, 2, 3, 3],
      [3, 1, 0, 1, 1],
      [4, 6, 8, 3, 8],
      [5, 2, 5, 1, 5],
      [6, 7, 1, 8, 4],
      [7, 4, 0, 5, 5],
      [8, 5, 4, 4, 6],
    ],
  },
  // 레벨 10 — 9×9, 9쌍
  {
    size: 9,
    endpoints: [
      [1, 1, 1, 3, 2],
      [2, 7, 6, 8, 8],
      [3, 2, 7, 2, 6],
      [4, 5, 4, 6, 5],
      [5, 8, 2, 8, 3],
      [6, 5, 1, 0, 2],
      [7, 0, 8, 4, 8],
      [8, 6, 8, 6, 3],
      [9, 3, 3, 2, 3],
    ],
  },
];

const COLORS = [
  '#E53935', // 1 빨강
  '#1E88E5', // 2 파랑
  '#43A047', // 3 초록
  '#FB8C00', // 4 주황
  '#8E24AA', // 5 보라
  '#00ACC1', // 6 청록
  '#FFB300', // 7 노랑
  '#F06292', // 8 분홍
  '#6D4C41', // 9 갈색
];

function getColor(num: number) {
  return COLORS[(num - 1) % COLORS.length];
}

// 셀 key
function key(r: number, c: number) { return `${r},${c}`; }

// 두 셀이 인접한지 확인
function adjacent(r1: number, c1: number, r2: number, c2: number) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

type Path = Array<[number, number]>;
type Paths = Record<number, Path>; // num → path

function buildEndpointMap(endpoints: Endpoint[], size: number) {
  const map: Record<string, number> = {};
  endpoints.forEach(([num, r1, c1, r2, c2]) => {
    map[key(r1, c1)] = num;
    map[key(r2, c2)] = num;
  });
  return map;
}

// path 위에 있는 셀 집합
function pathCells(paths: Paths): Record<string, number> {
  const result: Record<string, number> = {};
  Object.entries(paths).forEach(([num, path]) => {
    path.forEach(([r, c]) => { result[key(r, c)] = Number(num); });
  });
  return result;
}

function isComplete(paths: Paths, level: Level): boolean {
  const totalCells = level.size * level.size;
  const filled = pathCells(paths);
  if (Object.keys(filled).length !== totalCells) return false;
  // 모든 쌍이 연결됐는지 확인
  for (const [num, r1, c1, r2, c2] of level.endpoints) {
    const p = paths[num];
    if (!p || p.length < 2) return false;
    const head = p[0], tail = p[p.length - 1];
    const startsOk = (head[0] === r1 && head[1] === c1) || (head[0] === r2 && head[1] === c2);
    const endsOk = (tail[0] === r1 && tail[1] === c1) || (tail[0] === r2 && tail[1] === c2);
    if (!startsOk || !endsOk) return false;
  }
  return true;
}

const STORAGE_KEY = 'numberlink_progress';

export default function NumberlinkScreen() {
  const { width: rawWidth } = useWindowDimensions();
  const width = rawWidth || 375;
  const insets = useSafeAreaInsets();

  const [levelIdx, setLevelIdx] = useState(0);
  const [maxUnlocked, setMaxUnlocked] = useState(0);
  const [paths, setPathsState] = useState<Paths>({});
  const [drawing, setDrawingState] = useState<{ num: number; path: Path } | null>(null);
  const [showClear, setShowClear] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  // 제스처 핸들러에서 최신값을 동기적으로 읽기 위한 ref
  const pathsRef = useRef<Paths>({});
  const drawingRef = useRef<{ num: number; path: Path } | null>(null);

  const syncPaths = useCallback((p: Paths) => {
    pathsRef.current = p;
    setPathsState(p);
  }, []);
  const syncDrawing = useCallback((d: { num: number; path: Path } | null) => {
    drawingRef.current = d;
    setDrawingState(d);
  }, []);

  // 저장된 진행상황 로드
  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v) setMaxUnlocked(JSON.parse(v).maxUnlocked ?? 0);
    });
  }, []);

  const level = LEVELS[levelIdx];
  const endpointMap = React.useMemo(() => buildEndpointMap(level.endpoints, level.size), [level]);
  const occupied = React.useMemo(() => pathCells(paths), [paths]);

  const PADDING = 24;
  const GAP = 2;
  const cellSize = Math.min(Math.floor((width - PADDING * 2 - GAP * (level.size - 1)) / level.size), 64);

  const loadLevel = useCallback((idx: number) => {
    setLevelIdx(idx);
    syncPaths({});
    syncDrawing(null);
    setShowClear(false);
    setShowLevelSelect(false);
  }, [syncPaths, syncDrawing]);

  // 빠른 드래그 시 건너뛴 칸을 보간: (r1,c1)→(r2,c2) 사이 중간 칸 반환
  const interpolateCells = useCallback((r1: number, c1: number, r2: number, c2: number): Path => {
    const cells: Path = [];
    let r = r1, c = c1;
    const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
    // 이동량이 큰 방향을 먼저 처리
    if (Math.abs(c2 - c1) >= Math.abs(r2 - r1)) {
      while (c !== c2) { c += dc; cells.push([r, c]); }
      while (r !== r2) { r += dr; cells.push([r, c]); }
    } else {
      while (r !== r2) { r += dr; cells.push([r, c]); }
      while (c !== c2) { c += dc; cells.push([r, c]); }
    }
    return cells;
  }, []);

  // 단일 셀 진입 처리 (ref 기반 — 항상 최신 state 사용)
  const processEnterCell = useCallback((sr: number, sc: number, ep: Record<string, number>) => {
    const d = drawingRef.current;
    if (!d) return;
    const { num } = d;
    let path = d.path;
    let curPaths = { ...pathsRef.current };

    const last = path[path.length - 1];
    if (last[0] === sr && last[1] === sc) return;
    if (!adjacent(last[0], last[1], sr, sc)) return;

    // 되돌아가기
    const existIdx = path.findIndex(([pr, pc]) => pr === sr && pc === sc);
    if (existIdx !== -1) {
      path = path.slice(0, existIdx + 1);
      curPaths[num] = path;
      syncDrawing({ num, path });
      syncPaths(curPaths);
      return;
    }

    // 다른 번호의 엔드포인트면 진입 불가
    const epNum = ep[key(sr, sc)];
    if (epNum && epNum !== num) return;

    // 다른 경로가 점령한 칸이면 제거
    const occNum = Object.entries(curPaths).find(
      ([n, p]) => Number(n) !== num && p.some(([pr, pc]) => pr === sr && pc === sc)
    )?.[0];
    if (occNum) delete curPaths[Number(occNum)];

    path = [...path, [sr, sc]];
    curPaths[num] = path;

    if (epNum === num) {
      // 엔드포인트 도달 → 연결 완료
      syncDrawing(null);
      syncPaths(curPaths);
      if (isComplete(curPaths, level)) {
        const newMax = Math.max(maxUnlocked, levelIdx + 1);
        setMaxUnlocked(newMax);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ maxUnlocked: newMax }));
        setShowClear(true);
      }
    } else {
      syncDrawing({ num, path });
      syncPaths(curPaths);
    }
  }, [syncDrawing, syncPaths, level, levelIdx, maxUnlocked]);

  // 셀 터치 시작
  const onCellPressIn = useCallback((r: number, c: number) => {
    const k = key(r, c);
    const curPaths = pathsRef.current;
    const curOccupied = pathCells(curPaths);
    const num = endpointMap[k] ?? curOccupied[k];
    if (!num) return;

    if (curPaths[num]) {
      const existingPath = curPaths[num];
      const idx = existingPath.findIndex(([pr, pc]) => pr === r && pc === c);
      if (idx !== -1) {
        const trimmed = existingPath.slice(0, idx + 1);
        syncDrawing({ num, path: trimmed });
        syncPaths({ ...curPaths, [num]: trimmed });
        return;
      }
    }

    const next = { ...curPaths };
    delete next[num];
    syncDrawing({ num, path: [[r, c]] });
    syncPaths(next);
  }, [endpointMap, syncDrawing, syncPaths]);

  // 셀 드래그 진입 — 빠른 이동 시 중간 칸 보간
  const onCellEnter = useCallback((r: number, c: number) => {
    const d = drawingRef.current;
    if (!d) return;
    const last = d.path[d.path.length - 1];
    if (last[0] === r && last[1] === c) return;

    const steps = interpolateCells(last[0], last[1], r, c);
    for (const [sr, sc] of steps) {
      processEnterCell(sr, sc, endpointMap);
      if (!drawingRef.current) break; // 엔드포인트 도달 시 중단
    }
  }, [interpolateCells, processEnterCell, endpointMap]);

  const onCellPressOut = useCallback(() => {
    syncDrawing(null);
  }, [syncDrawing]);

  // 연결 완성된 번호 set
  const connectedNums = React.useMemo(() => {
    const result = new Set<number>();
    for (const [num, r1, c1, r2, c2] of level.endpoints) {
      const p = paths[num];
      if (!p || p.length < 2) continue;
      const head = p[0], tail = p[p.length - 1];
      const ends = [[r1, c1], [r2, c2]];
      const headOk = ends.some(([r, c]) => head[0] === r && head[1] === c);
      const tailOk = ends.some(([r, c]) => tail[0] === r && tail[1] === c);
      if (headOk && tailOk) result.add(num);
    }
    return result;
  }, [paths, level]);

  const totalCells = level.size * level.size;
  const filledCells = Object.keys(occupied).length;

  return (
    <>
      <Stack.Screen options={{ title: '넘버링크', headerBackTitle: '홈' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}
        scrollEnabled={false}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.levelBadge} onPress={() => setShowLevelSelect(true)} activeOpacity={0.7}>
            <Text style={styles.levelText}>Lv.{levelIdx + 1}</Text>
            <Text style={styles.levelArrow}> ▼</Text>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>채운 칸</Text>
              <Text style={styles.statValue}>{filledCells}/{totalCells}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>연결</Text>
              <Text style={styles.statValue}>{connectedNums.size}/{level.endpoints.length}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.resetBtn} onPress={() => loadLevel(levelIdx)} activeOpacity={0.7}>
            <Text style={styles.resetText}>↺</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>같은 숫자끼리 선으로 연결하고, 모든 칸을 채우세요!</Text>

        {/* 그리드 */}
        <View
          style={[styles.grid, { width: cellSize * level.size + GAP * (level.size - 1), userSelect: 'none', cursor: 'crosshair' } as any]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            const { locationX, locationY } = e.nativeEvent;
            const step = cellSize + GAP;
            const c = Math.floor(locationX / step);
            const r = Math.floor(locationY / step);
            if (r >= 0 && r < level.size && c >= 0 && c < level.size) {
              onCellPressIn(r, c);
            }
          }}
          onResponderMove={(e) => {
            const { locationX, locationY } = e.nativeEvent;
            const step = cellSize + GAP;
            const c = Math.floor(locationX / step);
            const r = Math.floor(locationY / step);
            if (r >= 0 && r < level.size && c >= 0 && c < level.size) {
              onCellEnter(r, c);
            }
          }}
          onResponderRelease={onCellPressOut}
        >
          {Array.from({ length: level.size }, (_, r) =>
            Array.from({ length: level.size }, (_, c) => {
              const k = key(r, c);
              const ep = endpointMap[k];
              const occNum = occupied[k];
              const color = ep ? getColor(ep) : occNum ? getColor(occNum) : null;
              const isConnected = occNum ? connectedNums.has(occNum) : false;

              // 이 셀의 경로 연결 방향 계산 (선 표시용)
              const pathNum = occNum;
              const path = pathNum ? paths[pathNum] : null;
              const posInPath = path ? path.findIndex(([pr, pc]) => pr === r && pc === c) : -1;
              const prev = path && posInPath > 0 ? path[posInPath - 1] : null;
              const next = path && posInPath < path.length - 1 ? path[posInPath + 1] : null;

              const hasUp = (prev && prev[0] === r - 1) || (next && next[0] === r - 1);
              const hasDown = (prev && prev[0] === r + 1) || (next && next[0] === r + 1);
              const hasLeft = (prev && prev[1] === c - 1) || (next && next[1] === c - 1);
              const hasRight = (prev && prev[1] === c + 1) || (next && next[1] === c + 1);

              return (
                <View
                  key={k}
                  style={[
                    styles.cell,
                    {
                      width: cellSize,
                      height: cellSize,
                      left: c * (cellSize + GAP),
                      top: r * (cellSize + GAP),
                    },
                    color && { backgroundColor: color + '22' },
                  ]}
                >
                  {/* 연결선 */}
                  {color && hasUp && (
                    <View pointerEvents="none" style={[styles.lineV, styles.lineUp, { backgroundColor: color, opacity: isConnected ? 1 : 0.75 }]} />
                  )}
                  {color && hasDown && (
                    <View pointerEvents="none" style={[styles.lineV, styles.lineDown, { backgroundColor: color, opacity: isConnected ? 1 : 0.75 }]} />
                  )}
                  {color && hasLeft && (
                    <View pointerEvents="none" style={[styles.lineH, styles.lineLeft, { backgroundColor: color, opacity: isConnected ? 1 : 0.75 }]} />
                  )}
                  {color && hasRight && (
                    <View pointerEvents="none" style={[styles.lineH, styles.lineRight, { backgroundColor: color, opacity: isConnected ? 1 : 0.75 }]} />
                  )}
                  {/* 경로 중심 도트 */}
                  {color && !ep && (
                    <View pointerEvents="none" style={[styles.dot, { backgroundColor: color, opacity: isConnected ? 1 : 0.75 }]} />
                  )}
                  {/* 엔드포인트 */}
                  {ep && (
                    <View pointerEvents="none" style={[styles.endpoint, { backgroundColor: getColor(ep), borderColor: isConnected ? '#fff' : 'transparent' }]}>
                      <Text style={[styles.endpointText, { fontSize: cellSize * 0.36 }]}>{ep}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* 클리어 모달 */}
        <Modal visible={showClear} transparent animationType="fade">
          <View style={styles.modalBg}>
            <View style={styles.modalBox}>
              <Text style={styles.modalEmoji}>🎉</Text>
              <Text style={styles.modalTitle}>완성!</Text>
              <Text style={styles.modalSub}>모든 숫자를 연결했어요!</Text>
              {levelIdx + 1 < LEVELS.length ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => loadLevel(levelIdx + 1)} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>다음 레벨 →</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.modalSub}>모든 레벨 클리어! 🏆</Text>
              )}
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => loadLevel(levelIdx)} activeOpacity={0.8}>
                <Text style={styles.secondaryBtnText}>다시 하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 레벨 선택 모달 */}
        <Modal visible={showLevelSelect} transparent animationType="slide">
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowLevelSelect(false)}>
            <View style={[styles.modalBox, { maxHeight: 360 }]}>
              <Text style={styles.modalTitle}>레벨 선택</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
                <View style={styles.levelGrid}>
                  {LEVELS.map((lv, idx) => {
                    const unlocked = idx <= maxUnlocked;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.lvBtn, idx === levelIdx && styles.lvBtnActive, !unlocked && styles.lvBtnLocked]}
                        onPress={() => unlocked && loadLevel(idx)}
                        activeOpacity={unlocked ? 0.8 : 1}
                      >
                        <Text style={[styles.lvBtnNum, idx === levelIdx && styles.lvBtnNumActive, !unlocked && styles.lvBtnNumLocked]}>
                          {unlocked ? idx + 1 : '🔒'}
                        </Text>
                        <Text style={styles.lvBtnSize}>{lv.size}×{lv.size}</Text>
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
  scroll: { flex: 1, backgroundColor: '#121213' },
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
  levelText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  levelArrow: { color: '#818384', fontSize: 11 },
  statsRow: { flexDirection: 'row', gap: 20 },
  statItem: { alignItems: 'center' },
  statLabel: { color: '#818384', fontSize: 11 },
  statValue: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
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
  resetText: { color: '#fff', fontSize: 18 },
  hint: { color: '#818384', fontSize: 13, textAlign: 'center', marginBottom: 28, lineHeight: 18 },
  grid: {
    position: 'relative',
  },
  cell: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 2,
  },
  lineV: {
    position: 'absolute',
    width: 8,
    left: '50%',
    marginLeft: -4,
    zIndex: 1,
  },
  lineH: {
    position: 'absolute',
    height: 8,
    top: '50%',
    marginTop: -4,
    zIndex: 1,
  },
  lineUp: { top: 0, height: '50%' },
  lineDown: { bottom: 0, height: '50%' },
  lineLeft: { left: 0, width: '50%' },
  lineRight: { right: 0, width: '50%' },
  endpoint: {
    width: '70%',
    height: '70%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    zIndex: 3,
  },
  endpointText: {
    color: '#fff',
    fontWeight: 'bold',
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
  modalEmoji: { fontSize: 48, marginBottom: 8 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  modalSub: { color: '#818384', fontSize: 15, marginBottom: 4 },
  primaryBtn: {
    backgroundColor: '#1E88E5',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { color: '#818384', fontSize: 15 },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  lvBtn: {
    width: 60,
    height: 60,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  lvBtnActive: { borderColor: '#1E88E5', backgroundColor: '#001A33' },
  lvBtnLocked: { opacity: 0.4 },
  lvBtnNum: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  lvBtnNumActive: { color: '#1E88E5' },
  lvBtnNumLocked: { color: '#818384' },
  lvBtnSize: { color: '#818384', fontSize: 10, marginTop: 2 },
});
