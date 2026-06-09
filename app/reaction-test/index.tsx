import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import {
  loadReactionStats, updateReactionStats,
  ReactionStats,
} from '../../utils/reactionStorage';
import LeaderboardView from '../../components/LeaderboardView';
import InfoModal from '../../components/InfoModal';

const ROUNDS = 5;
const MIN_DELAY = 1000;
const MAX_DELAY = 4000;

const REACTION_RULES = [
  { emoji: '🟥', text: '빨간 화면이 보이면 기다리세요.' },
  { emoji: '🟩', text: '초록색으로 바뀌는 순간 최대한 빨리 탭하세요!' },
  { emoji: '⚡', text: '초록 되기 전에 탭하면 "너무 일찍!" — 해당 라운드는 무효예요.' },
  { emoji: '🔁', text: `총 ${ROUNDS}번 측정 후 평균 반응속도를 보여줘요.` },
  { emoji: '🏆', text: '평균 기록이 최고 기록보다 빠르면 갱신돼요!' },
  { emoji: '💾', text: '기록은 Google 로그인 시 자동 저장되고 랭킹에 등록돼요.' },
];

type Phase = 'idle' | 'waiting' | 'go' | 'early' | 'result' | 'done';
type Tab = 'game' | 'ranking';

function getRating(ms: number): string {
  if (ms < 200) return '🐆 번개 반응!';
  if (ms < 300) return '⚡ 매우 빠름';
  if (ms < 400) return '👍 빠름';
  if (ms < 500) return '😊 보통';
  if (ms < 700) return '🐢 느림';
  return '😴 많이 느림';
}


export default function ReactionTestScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('game');
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState(0);
  const [stats, setStats] = useState<ReactionStats>({ totalGames: 0, bestMs: 0, distribution: Array(10).fill(0) });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const startTime = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadReactionStats().then(setStats);
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const handleTabChange = useCallback((t: Tab) => {
    setTab(t);
    // 게임 탭으로 돌아오면 게임 중단
    if (t === 'game' && (phase === 'waiting' || phase === 'go')) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPhase('idle');
      setResults([]);
      setRound(0);
      Animated.timing(bgAnim, { toValue: 0, duration: 80, useNativeDriver: false }).start();
    }
  }, [phase, bgAnim]);

  const goToGreen = useCallback(() => {
    setPhase('go');
    startTime.current = Date.now();
    Animated.timing(bgAnim, { toValue: 1, duration: 80, useNativeDriver: false }).start();
  }, [bgAnim]);

  const startRound = useCallback(() => {
    setPhase('waiting');
    setLastMs(0);
    Animated.timing(bgAnim, { toValue: 0, duration: 80, useNativeDriver: false }).start();
    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
    timeoutRef.current = setTimeout(goToGreen, delay);
  }, [bgAnim, goToGreen]);

  const handleTap = useCallback(() => {
    if (phase === 'idle' || phase === 'done') return;

    if (phase === 'waiting') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      Animated.timing(bgAnim, { toValue: 0, duration: 80, useNativeDriver: false }).start();
      setPhase('early');
      return;
    }

    if (phase === 'early' || phase === 'result') {
      startRound();
      return;
    }

    if (phase === 'go') {
      const ms = Date.now() - startTime.current;
      setLastMs(ms);
      Animated.timing(bgAnim, { toValue: 0, duration: 80, useNativeDriver: false }).start();

      const newResults = [...results, ms];
      setResults(newResults);

      if (newResults.length >= ROUNDS) {
        const avg = Math.round(newResults.reduce((a, b) => a + b, 0) / newResults.length);
        updateReactionStats(avg).then(setStats);
        setPhase('done');
      } else {
        setRound(r => r + 1);
        setPhase('result');
      }
    }
  }, [phase, results, bgAnim, startRound]);

  const handleStart = useCallback(() => {
    setResults([]);
    setRound(0);
    setLastMs(0);
    startRound();
  }, [startRound]);

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#8B0000', '#1B5E20'],
  });

  const avg = results.length > 0
    ? Math.round(results.reduce((a, b) => a + b, 0) / results.length)
    : 0;

  const isNewRecord = phase === 'done' && avg > 0 && (stats.bestMs === 0 || avg <= stats.bestMs);


  return (
    <>
      <Stack.Screen
        options={{
          title: '반응속도 테스트',
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
        title="반응속도 테스트"
        description={`초록색으로 바뀌는 순간 탭하세요!\n총 ${ROUNDS}번 측정해 평균을 계산해요.`}
        rules={REACTION_RULES}
      />

      {/* 탭 바 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'game' && styles.tabBtnActive]}
          onPress={() => handleTabChange('game')}
        >
          <Text style={[styles.tabText, tab === 'game' && styles.tabTextActive]}>게임</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'ranking' && styles.tabBtnActive]}
          onPress={() => handleTabChange('ranking')}
        >
          <Text style={[styles.tabText, tab === 'ranking' && styles.tabTextActive]}>🏆 랭킹</Text>
        </TouchableOpacity>
      </View>

      {tab === 'ranking' ? (
        <View style={styles.rankingContainer}>
          <LeaderboardView
            gameType="reaction-test"
            ascending={true}
            valueFormatter={v => `${v}ms`}
            subtitle="낮을수록 빨라요"
            accentColor="#A5D6A7"
            isLoggedIn={isLoggedIn}
          />
        </View>
      ) : (
        <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
          <TouchableOpacity style={styles.tapArea} onPress={handleTap} activeOpacity={1}>

            {/* 상단 통계 */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.bestMs > 0 ? `${stats.bestMs}ms` : '-'}</Text>
                <Text style={styles.statLabel}>최고 기록</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.totalGames}</Text>
                <Text style={styles.statLabel}>총 게임</Text>
              </View>
            </View>

            {/* 라운드 진행 */}
            {(phase !== 'idle' && phase !== 'done') && (
              <View style={styles.roundRow}>
                {Array(ROUNDS).fill(null).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.roundDot,
                      i < results.length && styles.roundDotDone,
                      i === results.length && styles.roundDotActive,
                    ]}
                  />
                ))}
              </View>
            )}

            {/* 메인 메시지 */}
            <View style={styles.center}>
              {phase === 'idle' && (
                <>
                  <Text style={styles.emoji}>⚡</Text>
                  <Text style={styles.mainText}>탭해서 시작</Text>
                  <Text style={styles.subText}>준비되면 탭하세요</Text>
                </>
              )}
              {phase === 'waiting' && (
                <>
                  <Text style={styles.emoji}>🔴</Text>
                  <Text style={styles.mainText}>기다리세요...</Text>
                  <Text style={styles.subText}>초록색이 되면 탭!</Text>
                </>
              )}
              {phase === 'go' && (
                <>
                  <Text style={styles.emoji}>🟢</Text>
                  <Text style={[styles.mainText, styles.goText]}>지금!</Text>
                  <Text style={styles.subText}>탭하세요!</Text>
                </>
              )}
              {phase === 'early' && (
                <>
                  <Text style={styles.emoji}>😅</Text>
                  <Text style={styles.mainText}>너무 일찍!</Text>
                  <Text style={styles.subText}>탭해서 다시 시도</Text>
                </>
              )}
              {phase === 'result' && (
                <>
                  <Text style={styles.emoji}>✅</Text>
                  <Text style={[styles.mainText, styles.resultMs]}>{lastMs}ms</Text>
                  <Text style={styles.subText}>탭해서 계속 ({round + 1}/{ROUNDS})</Text>
                </>
              )}
              {phase === 'done' && (
                <>
                  <Text style={styles.emoji}>{isNewRecord ? '🏆' : '🎯'}</Text>
                  <Text style={styles.mainText}>평균 {avg}ms</Text>
                  <Text style={styles.rating}>{getRating(avg)}</Text>
                  {isNewRecord && <Text style={styles.newRecord}>🎉 최고 기록 갱신!</Text>}
                  <View style={styles.resultList}>
                    {results.map((ms, i) => (
                      <Text key={i} style={styles.resultItem}>{i + 1}회: {ms}ms</Text>
                    ))}
                  </View>
                  {isNewRecord && isLoggedIn && (
                    <TouchableOpacity onPress={() => handleTabChange('ranking')} style={styles.viewRankBtn}>
                      <Text style={styles.viewRankBtnText}>🏆 랭킹 확인하기</Text>
                    </TouchableOpacity>
                  )}
                  {!isLoggedIn && (
                    <Text style={styles.guestNote}>🔒 로그인하면 랭킹에 등록돼요</Text>
                  )}
                </>
              )}
            </View>

            {(phase === 'idle' || phase === 'done') && (
              <TouchableOpacity style={styles.startButton} onPress={handleStart} activeOpacity={0.8}>
                <Text style={styles.startButtonText}>
                  {phase === 'idle' ? '▶ 시작' : '🔄 다시 하기'}
                </Text>
              </TouchableOpacity>
            )}

          </TouchableOpacity>
        </Animated.View>
      )}
    </>
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
    borderBottomColor: '#A5D6A7',
  },
  tabText: {
    color: '#818384',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#A5D6A7',
  },
  container: {
    flex: 1,
  },
  tapArea: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 16,
  },
  statBox: { alignItems: 'center' },
  statValue: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  roundRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  roundDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  roundDotDone: { backgroundColor: 'rgba(255,255,255,0.8)' },
  roundDotActive: { backgroundColor: '#FDD835' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emoji: { fontSize: 64, marginBottom: 8 },
  mainText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  goText: { fontSize: 48, color: '#A5D6A7' },
  resultMs: { fontSize: 48, color: '#FDD835' },
  subText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 4,
  },
  rating: { color: '#FDD835', fontSize: 20, fontWeight: '600', marginTop: 4 },
  newRecord: { color: '#A5D6A7', fontSize: 16, fontWeight: '700', marginTop: 4 },
  resultList: { marginTop: 16, gap: 4, alignItems: 'center' },
  resultItem: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  viewRankBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(165,214,167,0.2)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(165,214,167,0.4)',
  },
  viewRankBtnText: { color: '#A5D6A7', fontSize: 14, fontWeight: '700' },
  guestNote: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 16,
  },
  startButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 56,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // 랭킹 탭
  rankingContainer: {
    flex: 1,
    backgroundColor: '#121213',
  },
});
