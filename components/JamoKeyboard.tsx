import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TileStatus } from '../utils/gameLogic';

// 실제 키보드 배열 — 삭제(←)는 1행 맨 오른쪽, 모든 키 같은 크기
const ROW1 = ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','⌫'];
const ROW2 = ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'];
const ROW3 = ['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ'];

const KEY_W = 36;
const KEY_H = 44;
const KEY_GAP = 5;

interface Props {
  onKey: (key: string) => void;
  keyStatuses: Record<string, TileStatus>;
}

const KEY_COLORS: Record<TileStatus, string> = {
  correct: '#538D4E',
  present: '#B59F3B',
  absent: '#3A3A3C',
  empty: '#818384',
  active: '#818384',
};

export default function JamoKeyboard({ onKey, keyStatuses }: Props) {
  const renderKey = (key: string) => {
    const isAction = key === '⌫';
    const status = keyStatuses[key] ?? 'empty';
    const bg = isAction ? '#555' : KEY_COLORS[status];

    return (
      <TouchableOpacity
        key={key}
        onPress={() => onKey(key)}
        style={[styles.key, { backgroundColor: bg }]}
        activeOpacity={0.7}
      >
        <Text style={styles.keyText}>{key}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.keyboard}>
      <View style={styles.row}>{ROW1.map(renderKey)}</View>
      <View style={styles.row}>{ROW2.map(renderKey)}</View>
      <View style={styles.row}>{ROW3.map(renderKey)}</View>

      <TouchableOpacity onPress={() => onKey('✓')} style={styles.enterKey} activeOpacity={0.8}>
        <Text style={styles.enterText}>입력 확인</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    gap: KEY_GAP,
    paddingHorizontal: 6,
    paddingBottom: 16,
    alignSelf: 'center',
    // 9키 × KEY_W + 8gap × KEY_GAP + 양쪽 padding
    width: 9 * KEY_W + 8 * KEY_GAP + 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: KEY_GAP,
  },
  key: {
    width: KEY_W,
    height: KEY_H,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  enterKey: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#538D4E',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  enterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
