import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Modal, useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { loadWhackBest, recordWhackGame } from '../../utils/whackAMoleStorage';
import LeaderboardView from '../../components/LeaderboardView';

const GAME_DURATION = 30;
const NUM_HOLES = 9;

type MoleType = 'normal' | 'golden' | 'bomb';
type Phase = 'idle' | 'playing' | 'gameover';

function getDifficulty(elapsed: number) {
  if (elapsed < 10) return { maxMoles: 1, visibleMs: 1500, minDelay: 800, maxDelay: 1300 };
  if (elapsed < 20) return { maxMoles: 2, visibleMs: 1100, minDelay: 500, maxDelay: 1000 };
  return { maxMoles: 3, visibleMs: 700, minDelay: 300, maxDelay: 700 };
}

function randomMoleType(): MoleType {
  const r = Math.random();
  if (r < 0.10) return 'bomb';
  if (r < 0.30) return 'golden';
  return 'normal';
}

function moleScore(type: MoleType) {
  return type === 'golden' ? 3 : type === 'bomb' ? -1 : 1;
}

function moleEmoji(type: MoleType) {
  return type === 'golden' ? '⭐' : type === 'bomb' ? '💣' : '🐹';
}

interface HoleAnim {
  anim: Animated.Value;
  hideTimer: ReturnType<typeof setTimeout> | null;
}

export default function WhackAMoleScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const CELL = Math.min(Math.floor((width - 64) / 3), 110);

  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [bestScore, setBestScore] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hitFeedback, setHitFeedback] = useState<{ id: number; text: string; color: string } | null>(null);
  const [holeDisplays, setHoleDisplays] = useState<Array<{ visible: boolean; moleType: MoleType }>>(
    Array.from({ length: NUM_HOLES }, () => ({ visible: false, moleType: 'normal' as MoleType }))
  );

  const holeAnims = useRef<HoleAnim[]>(
    Array.from({ length: NUM_HOLES }, () => ({
      anim: new Animated.Value(0),
      hideTimer: null,
    }))
  );

  const scoreRef = useRef(0);
  const elapsedRef = useRef(0);
  const activeCountRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holeVisibleRef = useRef<boolean[]>(Array(NUM_HOLES).fill(false));

  useEffect(() => {
    loadWhackBest().then(best => setBestScore(best));
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => {
      clearAllTimers();
      subscription.unsubscribe();
    };
  }, []);

  const clearAllTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    holeAnims.current.forEach(h => { if (h.hideTimer) clearTimeout(h.hideTimer); });
  };

  const hideMole = useCallback((idx: number, instant = false) => {
    if (!holeVisibleRef.current[idx]) return;
    holeVisibleRef.current[idx] = false;
    activeCountRef.current = Math.max(0, activeCountRef.current - 1);

    const ha = holeAnims.current[idx];
    if (ha.hideTimer) { clearTimeout(ha.hideTimer); ha.hideTimer = null; }

    Animated.timing(ha.anim, {
      toValue: 0,
      duration: instant ? 50 : 160,
      useNativeDriver: true,
    }).start();

    setHoleDisplays(prev => prev.map((h, i) => i === idx ? { ...h, visible: false } : h));
  }, []);

  const scheduleNextSpawn = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const diff = getDifficulty(elapsedRef.current);
    if (activeCountRef.current >= diff.maxMoles) return;
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);

    const delay = diff.minDelay + Math.random() * (diff.maxDelay - diff.minDelay);
    spawnTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'playing') return;
      const diff2 = getDifficulty(elapsedRef.current);
      if (activeCountRef.current >= diff2.maxMoles) return;

      const emptyIdxs = holeVisibleRef.current
        .map((vis, i) => vis ? -1 : i)
        .filter(i => i >= 0);
      if (emptyIdxs.length === 0) return;

      const idx = emptyIdxs[Math.floor(Math.random() * emptyIdxs.length)];
      const type = randomMoleType();

      holeVisibleRef.current[idx] = true;
      activeCountRef.current++;

      setHoleDisplays(prev => prev.map((h, i) => i === idx ? { visible: true, moleType: type } : h));

      Animated.spring(holeAnims.current[idx].anim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 140,
        friction: 7,
      }).start();

      holeAnims.current[idx].hideTimer = setTimeout(() => {
        hideMole(idx);
        scheduleNextSpawn();
      }, diff2.visibleMs);

      // schedule another if slots available
      scheduleNextSpawn();
    }, delay);
  }, [hideMole]);

  const endGame = useCallback(() => {
    phaseRef.current = 'gameover';
    setPhase('gameover');
    clearAllTimers();

    for (let i = 0; i < NUM_HOLES; i++) hideMole(i, true);
    activeCountRef.current = 0;

    const finalScore = scoreRef.current;
    setBestScore(prev => {
      if (finalScore > prev) return finalScore;
      return prev;
    });
    recordWhackGame(finalScore);
  }, [hideMole]);

  const startGame = useCallback(() => {
    clearAllTimers();
    holeVisibleRef.current.fill(false);
    holeAnims.current.forEach(h => { h.anim.setValue(0); h.hideTimer = null; });

    scoreRef.current = 0;
    elapsedRef.current = 0;
    activeCountRef.current = 0;
    phaseRef.current = 'playing';

    setScore(0);
    setTimeLeft(GAME_DURATION);
    setPhase('playing');
    setHoleDisplays(Array.from({ length: NUM_HOLES }, () => ({ visible: false, moleType: 'normal' as MoleType })));

    timerRef.current = setInterval(() => {
      elapsedRef.current++;
      const remaining = GAME_DURATION - elapsedRef.current;
      setTimeLeft(remaining);
      if (remaining <= 0) endGame();
    }, 1000);

    scheduleNextSpawn();
  }, [scheduleNextSpawn, endGame]);

  const whackMole = useCallback((idx: number) => {
    if (!holeVisibleRef.current[idx] || phaseRef.current !== 'playing') return;

    const type = holeDisplays[idx].moleType;
    const pts = moleScore(type);
    const newScore = Math.max(0, scoreRef.current + pts);
    scoreRef.current = newScore;
    setScore(newScore);

    const color = type === 'bomb' ? '#f87171' : type === 'golden' ? '#fbbf24' : '#4ade80';
    setHitFeedback({ id: Date.now(), text: pts > 0 ? `+${pts}` : `${pts}`, color });
    setTimeout(() => setHitFeedback(f => f), 600);

    hideMole(idx, true);
    scheduleNextSpawn();
  }, [holeDisplays, hideMole, scheduleNextSpawn]);

  const isNewRecord = phase === 'gameover' && score > 0 && score >= bestScore;

  return (
    <>
      <Stack.Screen
        options={{
          title: '두더지 잡기',
          headerStyle: { backgroundColor: '#1a3a1a' },
          headerTintColor: '#fff',
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

      <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>점수</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>⏱</Text>
            <Text style={[styles.scoreValue, timeLeft <= 5 && styles.timerDanger]}>{timeLeft}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>최고</Text>
            <Text style={styles.scoreValue}>{bestScore}</Text>
          </View>
        </View>

        {hitFeedback && (
          <Text key={hitFeedback.id} style={[styles.hitFeedback, { color: hitFeedback.color }]}>
            {hitFeedback.text}
          </Text>
        )}

        <View style={styles.legend}>
          <Text style={styles.legendText}>🐹 +1</Text>
          <Text style={styles.legendText}>⭐ +3</Text>
          <Text style={styles.legendText}>💣 -1</Text>
        </View>

        <View style={[styles.grid, { gap: 12, width: CELL * 3 + 12 * 2 }]}>
          {holeDisplays.map((display, idx) => {
            const ha = holeAnims.current[idx];
            const translateY = ha.anim.interpolate({
              inputRange: [0, 1],
              outputRange: [CELL * 0.65, 0],
            });
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => whackMole(idx)}
                activeOpacity={0.9}
                style={[styles.cell, { width: CELL, height: CELL }]}
              >
                {/* mole (below hole overlay) */}
                <Animated.Text
                  style={[styles.moleEmoji, { fontSize: CELL * 0.54, transform: [{ translateY }] }]}
                >
                  {moleEmoji(display.moleType)}
                </Animated.Text>
                {/* hole drawn on top to occlude mole body */}
                <View style={[styles.holeOval, { width: CELL * 0.84, height: CELL * 0.36 }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {phase === 'idle' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayEmoji}>🐹</Text>
            <Text style={styles.overlayTitle}>두더지 잡기</Text>
            <Text style={styles.overlayDesc}>🐹 +1 　⭐ +3 　💣 -1</Text>
            {bestScore > 0 && <Text style={styles.overlayBest}>최고 기록  {bestScore}점</Text>}
            <TouchableOpacity style={styles.startBtn} onPress={startGame}>
              <Text style={styles.startBtnText}>시작</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'gameover' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayEmoji}>{isNewRecord ? '🏆' : '🐹'}</Text>
            <Text style={styles.overlayTitle}>게임 오버</Text>
            <Text style={styles.finalScore}>{score}점</Text>
            {isNewRecord && <Text style={styles.newRecord}>🎉 최고 기록 갱신!</Text>}
            {!isNewRecord && bestScore > 0 && (
              <Text style={styles.overlayBest}>최고  {bestScore}점</Text>
            )}
            <TouchableOpacity style={styles.startBtn} onPress={startGame}>
              <Text style={styles.startBtnText}>다시 시작</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={showLeaderboard} animationType="slide" onRequestClose={() => setShowLeaderboard(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>두더지 잡기 랭킹</Text>
            <TouchableOpacity onPress={() => setShowLeaderboard(false)}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          <LeaderboardView
            gameType="whack-a-mole"
            valueFormatter={(v) => `${v}점`}
            accentColor="#a3e635"
            isLoggedIn={isLoggedIn}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1a3a1a',
    alignItems: 'center',
    paddingTop: 20,
    gap: 12,
  },
  scoreRow: { flexDirection: 'row', gap: 12 },
  scoreBox: {
    backgroundColor: '#2d5a2d',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 72,
    borderWidth: 1,
    borderColor: '#4a8a4a',
  },
  scoreLabel: { color: '#a3d9a3', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  scoreValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  timerDanger: { color: '#f87171' },
  hitFeedback: {
    fontSize: 30,
    fontWeight: 'bold',
    height: 36,
  },
  legend: { flexDirection: 'row', gap: 20 },
  legendText: { color: '#a3d9a3', fontSize: 13 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cell: {
    backgroundColor: '#2d5a1a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3d7a2a',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    paddingBottom: 6,
  },
  moleEmoji: {
    position: 'absolute',
    bottom: 4,
    textAlign: 'center',
    zIndex: 1,
  },
  holeOval: {
    backgroundColor: '#0d1f0d',
    borderRadius: 100,
    zIndex: 2,
    marginBottom: 2,
    borderWidth: 2,
    borderColor: '#1a3a0a',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,26,10,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
  },
  overlayEmoji: { fontSize: 56 },
  overlayTitle: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  overlayDesc: { color: '#a3d9a3', fontSize: 16 },
  overlayBest: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  finalScore: { color: '#a3e635', fontSize: 52, fontWeight: 'bold' },
  newRecord: { color: '#fbbf24', fontSize: 17, fontWeight: '700' },
  startBtn: {
    marginTop: 8,
    backgroundColor: '#4a8a2a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderWidth: 1,
    borderColor: '#6aaa4a',
  },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#1a3a1a' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d5a2d',
  },
  modalTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
