import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { GameStats } from '../utils/storage';

interface Props {
  visible: boolean;
  onClose: () => void;
  stats: GameStats;
  won: boolean;
  attempts: number;
  answer: string;
}

export default function StatsModal({ visible, onClose, stats, won, attempts, answer }: Props) {
  const accuracy = stats.totalGames > 0
    ? Math.round((stats.wins / stats.totalGames) * 100)
    : 0;
  const maxDist = Math.max(...stats.distribution, 1);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{won ? '🎉 정답!' : '😢 실패'}</Text>
          <Text style={styles.answer}>정답: {answer}</Text>
          {won && <Text style={styles.sub}>{attempts}번 만에 맞췄어요!</Text>}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>통계</Text>
          <View style={styles.statsRow}>
            <StatBox label="총 게임" value={stats.totalGames} />
            <StatBox label="정답률" value={`${accuracy}%`} />
            <StatBox label="현재 연속" value={stats.currentStreak} />
            <StatBox label="최고 연속" value={stats.maxStreak} />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>시도 분포</Text>
          {stats.distribution.map((count, i) => (
            <View key={i} style={styles.distRow}>
              <Text style={styles.distLabel}>{i + 1}</Text>
              <View style={[styles.distBar, { flex: count / maxDist || 0.05, backgroundColor: won && attempts === i + 1 ? '#538D4E' : '#818384' }]}>
                <Text style={styles.distCount}>{count}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>계속하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1A1A1B',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  answer: {
    color: '#538D4E',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sub: {
    color: '#818384',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#3A3A3C',
    marginVertical: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#818384',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  distLabel: {
    color: '#fff',
    width: 20,
    textAlign: 'center',
    fontSize: 14,
  },
  distBar: {
    height: 24,
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 4,
    minWidth: 24,
  },
  distCount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  button: {
    backgroundColor: '#538D4E',
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
