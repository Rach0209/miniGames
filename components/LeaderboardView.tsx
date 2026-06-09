import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { fetchGameLeaderboard, LeaderboardEntry } from '../utils/leaderboard';

interface Props {
  gameType: string;
  ascending?: boolean;              // true=낮을수록 좋음 (반응속도)
  valueFormatter: (v: number) => string; // 값 표시 방식
  subtitle?: string;                // "낮을수록 빨라요" 등
  accentColor?: string;             // 게임별 강조색
  isLoggedIn: boolean;
  autoLoad?: boolean;               // 마운트 시 자동 로드 여부
}

function getMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}.`;
}

export default function LeaderboardView({
  gameType,
  ascending = false,
  valueFormatter,
  subtitle,
  accentColor = '#FDD835',
  isLoggedIn,
  autoLoad = true,
}: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchGameLeaderboard(gameType, ascending);
    setEntries(data);
    setLoading(false);
  }, [gameType, ascending]);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  const myRowStyle = { borderColor: accentColor, backgroundColor: `${accentColor}18` };
  const myTextStyle = { color: accentColor };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🏆 랭킹 TOP 20</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {loading ? (
        <ActivityIndicator color={accentColor} size="large" style={{ marginTop: 40 }} />
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={styles.emptyText}>아직 기록이 없어요</Text>
          <Text style={styles.emptySub}>첫 번째 랭커가 되어보세요!</Text>
        </View>
      ) : (
        <>
          {entries.map(entry => (
            <View
              key={entry.rank}
              style={[styles.row, entry.isMe && myRowStyle]}
            >
              <Text style={styles.medal}>{getMedal(entry.rank)}</Text>
              <View style={styles.info}>
                <Text style={[styles.name, entry.isMe && myTextStyle]}>
                  {entry.username}{entry.isMe ? ' (나)' : ''}
                </Text>
                <Text style={styles.games}>{entry.totalGames}회 플레이</Text>
              </View>
              <Text style={[styles.value, entry.isMe && myTextStyle]}>
                {valueFormatter(entry.value)}
              </Text>
            </View>
          ))}
          {!isLoggedIn && (
            <Text style={styles.loginNote}>🔒 로그인하면 랭킹에 등록돼요</Text>
          )}
        </>
      )}

      <TouchableOpacity style={styles.refreshBtn} onPress={load}>
        <Text style={styles.refreshText}>↻ 새로고침</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#818384',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySub: { color: '#818384', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  medal: {
    fontSize: 20,
    width: 36,
    textAlign: 'center',
  },
  info: { flex: 1, marginLeft: 8 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  games: { color: '#818384', fontSize: 12, marginTop: 2 },
  value: {
    color: '#FDD835',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginNote: {
    color: '#818384',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  refreshBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 10,
  },
  refreshText: { color: '#818384', fontSize: 14 },
});
