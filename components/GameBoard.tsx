import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TileStatus } from '../utils/gameLogic';

interface Props {
  guesses: string[][];
  statuses: TileStatus[][];
  currentGuess: string[];
  currentRow: number;
  wordLength: number;
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

export default function GameBoard({ guesses, statuses, currentGuess, currentRow, wordLength }: Props) {
  const rows = Array(5).fill(null);

  return (
    <View style={styles.board}>
      {rows.map((_, rowIdx) => {
        const isCurrentRow = rowIdx === currentRow;
        const isPastRow = rowIdx < currentRow;

        return (
          <View key={rowIdx} style={styles.row}>
            {Array(wordLength).fill(null).map((_, colIdx) => {
              let jamo = '';
              let status: TileStatus = 'empty';

              if (isPastRow) {
                jamo = guesses[rowIdx]?.[colIdx] ?? '';
                status = statuses[rowIdx]?.[colIdx] ?? 'absent';
              } else if (isCurrentRow) {
                jamo = currentGuess[colIdx] ?? '';
                status = jamo ? 'active' : 'empty';
              }

              return (
                <View
                  key={colIdx}
                  style={[
                    styles.tile,
                    { backgroundColor: TILE_COLORS[status], borderColor: TILE_BORDER_COLORS[status] },
                  ]}
                >
                  <Text style={styles.tileText}>{jamo}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const TILE_SIZE = 58;
const BOARD_MAX = TILE_SIZE * 5 + 6 * 4; // 5 tiles + 4 gaps = 314

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
