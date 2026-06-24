import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 퍼즐 정의: solution은 0/1 2차원 배열, title은 완성 시 표시할 이름
interface Puzzle {
  title: string;
  solution: number[][];
}

const PUZZLES: Puzzle[] = [
  {
    title: '하트 ❤️',
    solution: [
      [0,1,1,0,1,1,0],
      [1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1],
      [0,1,1,1,1,1,0],
      [0,0,1,1,1,0,0],
      [0,0,0,1,0,0,0],
    ],
  },
  {
    title: '별 ⭐',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,0,1,0],
      [1,0,0,0,1],
    ],
  },
  {
    title: '집 🏠',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [1,1,0,1,1],
      [1,1,0,1,1],
    ],
  },
  {
    title: '물고기 🐟',
    solution: [
      [0,0,1,1,1,0],
      [0,1,1,1,1,1],
      [1,1,1,1,1,0],
      [0,1,1,1,1,1],
      [0,0,1,1,1,0],
    ],
  },
  {
    title: '나무 🌲',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,0,1,0,0],
      [0,0,1,0,0],
    ],
  },
  {
    title: '달 🌙',
    solution: [
      [0,1,1,0,0],
      [1,1,1,1,0],
      [1,1,1,1,1],
      [1,1,1,1,0],
      [0,1,1,0,0],
    ],
  },
  {
    title: '번개 ⚡',
    solution: [
      [0,0,1,1,1],
      [0,1,1,1,0],
      [0,1,1,0,0],
      [0,1,0,0,0],
      [1,1,0,0,0],
    ],
  },
  {
    title: '다이아몬드 💎',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
    ],
  },
  {
    title: '체스판',
    solution: [
      [1,0,1,0,1,0],
      [0,1,0,1,0,1],
      [1,0,1,0,1,0],
      [0,1,0,1,0,1],
      [1,0,1,0,1,0],
      [0,1,0,1,0,1],
    ],
  },
  {
    title: '십자가 ✝️',
    solution: [
      [0,1,1,1,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,1,1,1,0],
    ],
  },
  {
    title: '로켓 🚀',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,0,1,0],
      [1,0,0,0,1],
    ],
  },
  {
    title: '왕관 👑',
    solution: [
      [1,0,1,0,1],
      [1,0,1,0,1],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [0,1,1,1,0],
    ],
  },
  {
    title: '스마일 😊',
    solution: [
      [0,1,1,1,0],
      [1,0,1,0,1],
      [1,0,0,0,1],
      [1,0,1,0,1],
      [0,1,1,1,0],
    ],
  },
  {
    title: '꽃 🌸',
    solution: [
      [0,1,0,1,0],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,0,1,0],
    ],
  },
  {
    title: '자물쇠 🔒',
    solution: [
      [0,1,1,1,0],
      [1,0,0,0,1],
      [1,1,1,1,1],
      [1,1,0,1,1],
      [1,1,1,1,1],
    ],
  },
  {
    title: '태양 ☀️',
    solution: [
      [0,1,0,1,0],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,0,1,0],
    ],
  },
  {
    title: '눈사람 ⛄',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,0,1,0,1],
      [0,1,1,1,0],
      [1,1,1,1,1],
    ],
  },
  {
    title: '나비 🦋',
    solution: [
      [1,1,0,1,0,1,1],
      [1,1,1,0,1,1,1],
      [0,1,1,1,1,1,0],
      [0,0,1,1,1,0,0],
      [0,0,0,1,0,0,0],
    ],
  },
  {
    title: '사과 🍎',
    solution: [
      [0,0,1,0,0],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [0,1,1,1,0],
    ],
  },
  {
    title: '비행기 ✈️',
    solution: [
      [0,0,0,1,0,0,0],
      [0,0,1,1,1,0,0],
      [1,1,1,1,1,1,1],
      [0,0,1,1,1,0,0],
      [0,0,0,1,1,0,0],
    ],
  },
  {
    title: '우산 ☂️',
    solution: [
      [0,0,1,1,1,0,0],
      [0,1,1,1,1,1,0],
      [1,1,1,1,1,1,1],
      [0,0,0,1,0,0,0],
      [0,0,0,1,0,0,0],
      [0,0,0,1,1,0,0],
    ],
  },
  {
    title: '핸드폰 📱',
    solution: [
      [1,1,1,1],
      [1,1,1,1],
      [1,0,0,1],
      [1,0,0,1],
      [1,0,0,1],
      [1,1,1,1],
      [0,1,1,0],
    ],
  },
  {
    title: '음표 🎵',
    solution: [
      [0,1,1,1],
      [0,1,0,1],
      [0,1,0,0],
      [1,1,0,0],
      [1,1,0,0],
    ],
  },
  {
    title: '버섯 🍄',
    solution: [
      [0,1,1,1,1,0],
      [1,1,0,0,1,1],
      [1,1,1,1,1,1],
      [0,1,1,1,1,0],
      [0,0,1,1,0,0],
    ],
  },
  {
    title: '눈꽃 ❄️',
    solution: [
      [0,0,1,0,1,0,0],
      [0,0,0,1,0,0,0],
      [1,0,0,1,0,0,1],
      [0,1,1,1,1,1,0],
      [1,0,0,1,0,0,1],
      [0,0,0,1,0,0,0],
      [0,0,1,0,1,0,0],
    ],
  },
  {
    title: '축구공 ⚽',
    solution: [
      [0,0,1,1,1,0,0],
      [0,1,1,0,1,1,0],
      [1,1,0,1,0,1,1],
      [1,0,1,1,1,0,1],
      [1,1,0,1,0,1,1],
      [0,1,1,0,1,1,0],
      [0,0,1,1,1,0,0],
    ],
  },
  {
    title: '로봇 🤖',
    solution: [
      [0,1,1,1,0],
      [1,1,1,1,1],
      [1,0,1,0,1],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [1,0,0,0,1],
    ],
  },
  {
    title: '자동차 🚗',
    solution: [
      [0,0,1,1,1,0,0],
      [0,1,1,1,1,1,0],
      [1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1],
      [0,1,1,0,1,1,0],
    ],
  },
  {
    title: '고양이 🐱',
    solution: [
      [1,1,0,0,1,1],
      [1,1,1,1,1,1],
      [0,1,0,0,1,0],
      [0,1,1,1,1,0],
      [0,0,1,1,0,0],
      [0,0,1,1,0,0],
    ],
  },
  {
    title: '피자 🍕',
    solution: [
      [1,1,1,1,1],
      [1,0,1,0,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
    ],
  },
  {
    title: '기타 🎸',
    solution: [
      [0,1,1,1,0],
      [1,1,0,1,1],
      [1,1,0,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
    ],
  },
  {
    title: '지구 🌍',
    solution: [
      [0,1,1,1,1,0],
      [1,1,0,1,0,1],
      [1,0,1,1,1,1],
      [1,1,1,1,0,1],
      [1,0,1,0,1,1],
      [0,1,1,1,1,0],
    ],
  },
  {
    title: '사람 🧍',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [1,1,1,1,1],
      [0,0,1,0,0],
      [0,1,0,1,0],
      [0,1,0,1,0],
      [0,1,0,1,0],
    ],
  },
  {
    title: '배 ⛵',
    solution: [
      [0,0,1,0,0,0,0],
      [0,0,1,1,0,0,0],
      [0,0,1,1,1,0,0],
      [1,1,1,1,1,1,1],
      [0,1,1,1,1,1,0],
      [0,0,1,1,1,0,0],
    ],
  },
  {
    title: '포도 🍇',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
    ],
  },
  {
    title: '새 🐦',
    solution: [
      [0,0,1,0,0,0],
      [0,1,1,1,1,0],
      [1,1,1,0,1,1],
      [0,1,1,1,1,0],
      [0,0,1,1,0,0],
    ],
  },
  {
    title: '손 ✋',
    solution: [
      [1,0,1,0,1],
      [1,0,1,0,1],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
    ],
  },
  {
    title: '컵 ☕',
    solution: [
      [1,1,1,1,0],
      [1,0,0,1,1],
      [1,0,0,1,1],
      [1,0,0,1,0],
      [0,1,1,0,0],
    ],
  },
  {
    title: '아이스크림 🍦',
    solution: [
      [0,1,1,0],
      [1,1,1,1],
      [1,1,1,1],
      [0,1,1,0],
      [0,1,1,0],
      [0,0,1,0],
      [0,0,1,0],
    ],
  },
  {
    title: '폭탄 💣',
    solution: [
      [0,0,0,1,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [0,1,1,1,0],
    ],
  },
  {
    title: '방패 🛡️',
    solution: [
      [1,1,1,1,1],
      [1,0,1,0,1],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
    ],
  },
  {
    title: '왕 ♔',
    solution: [
      [1,0,1,0,1],
      [1,0,1,0,1],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
    ],
  },
  {
    title: '게 🦀',
    solution: [
      [1,0,0,0,0,0,1],
      [1,0,1,1,1,0,1],
      [1,1,1,1,1,1,1],
      [0,1,1,0,1,1,0],
      [0,1,0,0,0,1,0],
      [1,0,0,0,0,0,1],
    ],
  },
  {
    title: '나무(큰) 🌳',
    solution: [
      [0,0,0,1,0,0,0],
      [0,0,1,1,1,0,0],
      [0,1,1,1,1,1,0],
      [1,1,1,1,1,1,1],
      [0,1,1,1,1,1,0],
      [0,0,1,1,1,0,0],
      [0,0,0,1,0,0,0],
      [0,0,0,1,0,0,0],
    ],
  },
  {
    title: '집(큰) 🏡',
    solution: [
      [0,0,0,1,0,0,0],
      [0,0,1,1,1,0,0],
      [0,1,1,1,1,1,0],
      [1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1],
      [1,1,0,1,0,1,1],
      [1,1,0,1,0,1,1],
    ],
  },
  {
    title: '폰 ♟️',
    solution: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
    ],
  },
  {
    title: '기차 🚂',
    solution: [
      [0,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1],
      [1,0,0,0,1,0,0,0,1],
      [1,1,1,1,1,1,1,1,1],
      [0,1,0,0,0,0,0,1,0],
    ],
  },
  {
    title: '상어 🦈',
    solution: [
      [0,0,0,0,0,1,0,0],
      [0,0,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,0],
      [0,0,0,0,0,1,0,1],
    ],
  },
  {
    title: '해골 💀',
    solution: [
      [0,1,1,1,1,1,0],
      [1,1,1,1,1,1,1],
      [1,0,1,0,1,0,1],
      [1,1,1,1,1,1,1],
      [0,1,1,1,1,1,0],
      [0,0,1,0,1,0,0],
      [0,0,1,0,1,0,0],
      [0,0,1,1,1,0,0],
    ],
  },
  {
    title: '성 🏰',
    solution: [
      [1,0,1,0,1,0,1,0,1],
      [1,1,1,0,1,0,1,1,1],
      [1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,0],
      [0,1,0,0,1,0,0,1,0],
      [0,1,1,1,1,1,1,1,0],
      [0,1,1,0,0,0,1,1,0],
      [0,1,1,0,0,0,1,1,0],
      [0,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,0],
    ],
  },
];

const STORAGE_KEY = 'nonogram_progress';

// 힌트 계산: 행/열의 연속된 1 블록
function calcHints(line: number[]): number[] {
  const result: number[] = [];
  let count = 0;
  for (const v of line) {
    if (v === 1) {
      count++;
    } else if (count > 0) {
      result.push(count);
      count = 0;
    }
  }
  if (count > 0) result.push(count);
  return result.length > 0 ? result : [0];
}

// 셀 상태: 0=빈칸, 1=채움, 2=X표시(오답 방지용)
type CellState = 0 | 1 | 2;

function checkComplete(grid: CellState[][], solution: number[][]): boolean {
  for (let r = 0; r < solution.length; r++) {
    for (let c = 0; c < solution[r].length; c++) {
      if ((grid[r][c] === 1 ? 1 : 0) !== solution[r][c]) return false;
    }
  }
  return true;
}

export default function NonogramScreen() {
  const { width: rawWidth } = useWindowDimensions();
  const width = rawWidth || 375;
  const insets = useSafeAreaInsets();

  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [maxUnlocked, setMaxUnlocked] = useState(0);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [drawMode, setDrawMode] = useState<1 | 2>(1); // 1=채우기, 2=X표시

  const puzzle = PUZZLES[puzzleIdx];
  const rows = puzzle.solution.length;
  const cols = puzzle.solution[0].length;

  const [grid, setGrid] = useState<CellState[][]>(() =>
    Array(rows).fill(null).map(() => Array(cols).fill(0))
  );

  // 힌트 계산
  const rowHints = useMemo(() => puzzle.solution.map(row => calcHints(row)), [puzzle]);
  const colHints = useMemo(() =>
    Array.from({ length: cols }, (_, c) => calcHints(puzzle.solution.map(row => row[c]))),
    [puzzle, cols]
  );

  // 힌트 영역 너비/높이
  const maxRowHintLen = Math.max(...rowHints.map(h => h.length));
  const maxColHintLen = Math.max(...colHints.map(h => h.length));

  const PADDING = 16;
  const hintColW = 28 * maxRowHintLen + 4; // 행 힌트 영역 너비
  const availW = width - PADDING * 2 - hintColW;
  const cellSize = Math.min(Math.max(Math.floor(availW / cols), 24), 52);
  const hintRowH = 20 * maxColHintLen + 4; // 열 힌트 영역 높이

  const gridCursor = (() => {
    const emoji = drawMode === 1 ? '✏️' : '✖️';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><text y='26' font-size='24'>${emoji}</text></svg>`;
    const encoded = encodeURIComponent(svg);
    const hotX = drawMode === 1 ? 0 : 12;
    const hotY = drawMode === 1 ? 26 : 18;
    return `url("data:image/svg+xml,${encoded}") ${hotX} ${hotY}, crosshair`;
  })();

  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v) setMaxUnlocked(JSON.parse(v).maxUnlocked ?? 0);
    });
  }, []);

  const loadPuzzle = useCallback((idx: number) => {
    const p = PUZZLES[idx];
    setPuzzleIdx(idx);
    setGrid(Array(p.solution.length).fill(null).map(() => Array(p.solution[0].length).fill(0)));
    setShowClear(false);
    setShowLevelSelect(false);
  }, []);

  const [painting, setPainting] = useState<{ mode: CellState } | null>(null);

  const tapCell = useCallback((r: number, c: number, isStart: boolean) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      if (isStart) {
        // 첫 탭: 현재 상태에 따라 모드 결정
        const cur = prev[r][c];
        const nextVal: CellState = cur === drawMode ? 0 : drawMode;
        setPainting({ mode: nextVal });
        next[r][c] = nextVal;
      } else {
        if (painting) next[r][c] = painting.mode;
      }

      if (checkComplete(next, puzzle.solution)) {
        const newMax = Math.max(maxUnlocked, puzzleIdx + 1);
        setMaxUnlocked(newMax);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ maxUnlocked: newMax }));
        setShowClear(true);
      }
      return next;
    });
  }, [drawMode, painting, puzzle, puzzleIdx, maxUnlocked]);

  // 행 힌트가 현재 그리드와 일치하는지 확인
  const rowDone = useMemo(() =>
    grid.map((row, r) => {
      const hints = calcHints(row.map(v => v === 1 ? 1 : 0));
      return JSON.stringify(hints) === JSON.stringify(rowHints[r]);
    }),
    [grid, rowHints]
  );
  const colDone = useMemo(() =>
    Array.from({ length: cols }, (_, c) => {
      const col = grid.map(row => row[c] === 1 ? 1 : 0);
      const hints = calcHints(col);
      return JSON.stringify(hints) === JSON.stringify(colHints[c]);
    }),
    [grid, colHints, cols]
  );

  return (
    <>
      <Stack.Screen options={{ title: '노노그램', headerBackTitle: '홈' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}

      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.levelBadge} onPress={() => setShowLevelSelect(true)} activeOpacity={0.7}>
            <Text style={styles.levelText}>No.{puzzleIdx + 1}</Text>
            <Text style={styles.levelArrow}> ▼</Text>
          </TouchableOpacity>

          {/* 드로우 모드 토글 */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, drawMode === 1 && styles.modeBtnActive]}
              onPress={() => setDrawMode(1)}
              activeOpacity={0.8}
            >
              <Text style={styles.modeBtnText}>■ 채우기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, drawMode === 2 && styles.modeBtnActiveX]}
              onPress={() => setDrawMode(2)}
              activeOpacity={0.8}
            >
              <Text style={styles.modeBtnText}>✕ X표시</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.resetBtn} onPress={() => loadPuzzle(puzzleIdx)} activeOpacity={0.7}>
            <Text style={styles.resetText}>↺</Text>
          </TouchableOpacity>
        </View>

        {/* 퍼즐 제목 */}
        <Text style={styles.hint}>숫자는 그 줄에서 연속으로 채울 칸 수예요</Text>

        {/* 그리드 영역 */}
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', userSelect: 'none', cursor: gridCursor } as any}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderRelease={() => setPainting(null)}
        >
          {/* 행 힌트 */}
          <View style={{ width: hintColW, marginTop: hintRowH }}>
            {rowHints.map((hints, r) => (
              <View key={r} style={[styles.rowHint, { height: cellSize }]}>
                {hints.map((h, i) => (
                  <Text key={i} style={[styles.hintText, rowDone[r] && styles.hintDone]}>{h}</Text>
                ))}
              </View>
            ))}
          </View>

          {/* 열 힌트 + 셀 그리드 */}
          <View>
            {/* 열 힌트 */}
            <View style={{ flexDirection: 'row', height: hintRowH }}>
              {colHints.map((hints, c) => (
                <View key={c} style={[styles.colHint, { width: cellSize }]}>
                  {hints.map((h, i) => (
                    <Text key={i} style={[styles.hintText, colDone[c] && styles.hintDone]}>{h}</Text>
                  ))}
                </View>
              ))}
            </View>

            {/* 셀 */}
            {grid.map((row, r) => (
              <View key={r} style={{ flexDirection: 'row' }}>
                {row.map((val, c) => (
                  <View
                    key={c}
                    style={[
                      styles.cell,
                      { width: cellSize, height: cellSize },
                      val === 1 && styles.cellFilled,
                      // 5칸마다 굵은 선
                      r % 5 === 0 && { borderTopWidth: 2 },
                      c % 5 === 0 && { borderLeftWidth: 2 },
                    ]}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={() => tapCell(r, c, true)}
                    onResponderMove={() => tapCell(r, c, false)}
                  >
                    {val === 2 && <Text style={styles.xMark}>✕</Text>}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* 클리어 모달 */}
        <Modal visible={showClear} transparent animationType="fade">
          <View style={styles.modalBg}>
            <View style={styles.modalBox}>
              <Text style={styles.modalEmoji}>🎉</Text>
              <Text style={styles.modalTitle}>완성!</Text>
              <Text style={styles.modalPuzzleName}>{puzzle.title}</Text>
              {puzzleIdx + 1 < PUZZLES.length ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => loadPuzzle(puzzleIdx + 1)} activeOpacity={0.8}>
                  <Text style={styles.primaryBtnText}>다음 퍼즐 →</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.modalSub}>모든 퍼즐 클리어! 🏆</Text>
              )}
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowClear(false)} activeOpacity={0.8}>
                <Text style={styles.secondaryBtnText}>계속 보기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 퍼즐 선택 모달 */}
        <Modal visible={showLevelSelect} transparent animationType="slide">
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowLevelSelect(false)}>
            <View style={[styles.modalBox, { maxHeight: 420 }]}>
              <Text style={styles.modalTitle}>퍼즐 선택</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
                <View style={styles.levelGrid}>
                  {PUZZLES.map((p, idx) => {
                    const unlocked = idx <= maxUnlocked;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.lvBtn, idx === puzzleIdx && styles.lvBtnActive, !unlocked && styles.lvBtnLocked]}
                        onPress={() => unlocked && loadPuzzle(idx)}
                        activeOpacity={unlocked ? 0.8 : 1}
                      >
                        <Text style={[styles.lvBtnNum, idx === puzzleIdx && styles.lvBtnNumActive, !unlocked && { color: '#555' }]}>
                          {unlocked ? idx + 1 : '🔒'}
                        </Text>
                        <Text style={styles.lvBtnTitle} numberOfLines={1}>
                          {unlocked ? p.title.split(' ')[1] : '??'}
                        </Text>
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
    padding: 16,
    paddingTop: 24,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  modeRow: { flexDirection: 'row', gap: 6 },
  modeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  modeBtnActive: { borderColor: '#fff', backgroundColor: '#3A3A3C' },
  modeBtnActiveX: { borderColor: '#E53935', backgroundColor: '#2A0A0A' },
  modeBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
  hint: { color: '#818384', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  rowHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 4,
    gap: 2,
  },
  colHint: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
    gap: 0,
  },
  hintText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
  hintDone: { color: '#4CAF50' },
  cell: {
    borderWidth: 1,
    borderColor: '#3A3A3C',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1B',
  },
  cellFilled: {
    backgroundColor: '#E8E8E8',
  },
  xMark: {
    color: '#E53935',
    fontSize: 10,
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
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  modalPuzzleName: { color: '#FFB800', fontSize: 18, marginBottom: 4 },
  modalSub: { color: '#818384', fontSize: 15, marginBottom: 4 },
  primaryBtn: {
    backgroundColor: '#4CAF50',
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
    width: 64,
    height: 64,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    paddingHorizontal: 4,
  },
  lvBtnActive: { borderColor: '#4CAF50', backgroundColor: '#0A1F0A' },
  lvBtnLocked: { opacity: 0.4 },
  lvBtnNum: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  lvBtnNumActive: { color: '#4CAF50' },
  lvBtnTitle: { color: '#818384', fontSize: 10, marginTop: 2, textAlign: 'center' },
});
