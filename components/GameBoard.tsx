import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TileStatus } from '../utils/gameLogic';

interface Props {
  guesses: string[][];
  statuses: TileStatus[][];
  currentGuess: string[];
  currentRow: number;
  wordLength: number;
  animatingRow?: number;
}

const TILE_COLORS: Record<TileStatus, string> = {
  correct: '#538D4E',
  present: '#B59F3B',
  absent: '#3A3A3C',
  empty: '#121213',
  active: '#121213',
};

const TILE_BORDER_COLORS: Record<TileStatus, string> = {
  correct: '#538D4E',
  present: '#B59F3B',
  absent: '#3A3A3C',
  empty: '#3A3A3C',
  active: '#999',
};

export default function GameBoard({ guesses, statuses, currentGuess, currentRow, wordLength, animatingRow }: Props) {
  const animValues = useRef(Array(wordLength).fill(null).map(() => new Animated.Value(1)));
  const [flippedCount, setFlippedCount] = useState(-1);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (animatingRow === undefined || animatingRow < 0) return;

    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];

    animValues.current.forEach(v => v.setValue(1));
    setFlippedCount(-1);

    for (let col = 0; col < wordLength; col++) {
      const delay = col * 300;
      const t1 = setTimeout(() => {
        Animated.timing(animValues.current[col], {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }, delay);

      const t2 = setTimeout(() => {
        setFlippedCount(col);
        Animated.timing(animValues.current[col], {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }, delay + 150);

      timeouts.current.push(t1, t2);
    }

    return () => timeouts.current.forEach(clearTimeout);
  }, [animatingRow]);

  const rows = Array(5).fill(null);

  return (
    <View style={styles.board}>
      {rows.map((_, rowIdx) => {
        const isCurrentRow = rowIdx === currentRow;
        const isPastRow = rowIdx < currentRow;
        const isAnimatingRow = rowIdx === animatingRow;

        return (
          <View key={rowIdx} style={styles.row}>
            {Array(wordLength).fill(null).map((_, colIdx) => {
              let jamo = '';
              let status: TileStatus = 'empty';

              if (isPastRow) {
                jamo = guesses[rowIdx]?.[colIdx] ?? '';
                const revealed = !isAnimatingRow || colIdx <= flippedCount;
                status = revealed ? (statuses[rowIdx]?.[colIdx] ?? 'absent') : 'absent';
              } else if (isCurrentRow) {
                jamo = currentGuess[colIdx] ?? '';
                status = jamo ? 'active' : 'empty';
              }

              const scaleY = isAnimatingRow ? animValues.current[colIdx] : new Animated.Value(1);

              return (
                <Animated.View
                  key={colIdx}
                  style={[
                    styles.tile,
                    {
                      backgroundColor: TILE_COLORS[status],
                      borderColor: TILE_BORDER_COLORS[status],
                      transform: [{ scaleY }],
                    },
                  ]}
                >
                  <Text style={styles.tileText}>{jamo}</Text>
                </Animated.View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const TILE_SIZE = 58;
const BOARD_MAX = TILE_SIZE * 5 + 6 * 4;

const styles = StyleSheet.create({
  board: {
    gap: 6,
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
    maxWidth: BOARD_MAX,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
