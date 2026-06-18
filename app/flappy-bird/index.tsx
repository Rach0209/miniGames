import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';
import { loadFlappyBirdBest, recordFlappyBirdGame } from '../../utils/flappyBirdStorage';
import LeaderboardView from '../../components/LeaderboardView';

// ── constants ──────────────────────────────────────────────
const BIRD_X = 80;
const BIRD_SIZE = 36;
const HITBOX_SHRINK = 7;
const PIPE_WIDTH = 60;
const PIPE_CAP_EXTRA = 7;
const PIPE_CAP_H = 18;
const PIPE_GAP = 185;
const PIPE_SPEED = 2.6;
const PIPE_SPAWN_FRAMES = 210;
const GRAVITY = 0.18;
const JUMP_VEL = -5.7;
const GROUND_H = 48;

type Phase = 'idle' | 'playing' | 'dead';

interface Pipe {
  id: number;
  x: number;
  gapY: number;
  passed: boolean;
}

// ── component ──────────────────────────────────────────────
export default function FlappyBirdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender(n => n + 1), []);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const G = useRef({
    phase: 'idle' as Phase,
    birdY: 200,
    birdVel: 0,
    birdRot: 0,
    pipes: [] as Pipe[],
    score: 0,
    bestScore: 0,
    frame: 0,
    nextId: 0,
  });

  const dims = useRef({ W: 375, H: 600 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    loadFlappyBirdBest().then(best => {
      G.current.bestScore = best;
      rerender();
    });

    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      subscription.unsubscribe();
    };
  }, [rerender]);

  // ── game loop ──────────────────────────────────────────
  const loop = useCallback(() => {
    const g = G.current;
    const { W, H } = dims.current;
    const playH = H - GROUND_H;

    if (g.phase !== 'playing') return;

    // physics (max fall speed 6px/frame)
    g.birdVel = Math.min(g.birdVel + GRAVITY, 4.5);
    g.birdY += g.birdVel;
    g.birdRot = Math.max(-30, Math.min(90, g.birdVel * 5));
    g.frame++;

    // spawn pipe
    if (g.frame % PIPE_SPAWN_FRAMES === 0) {
      const margin = 110;
      const gapY = margin + Math.random() * (playH - margin * 2);
      g.pipes.push({ id: g.nextId++, x: W + 10, gapY, passed: false });
    }

    // move pipes + score
    for (let i = g.pipes.length - 1; i >= 0; i--) {
      g.pipes[i].x -= PIPE_SPEED;
      if (g.pipes[i].x < -(PIPE_WIDTH + PIPE_CAP_EXTRA + 20)) {
        g.pipes.splice(i, 1);
        continue;
      }
      if (!g.pipes[i].passed && g.pipes[i].x + PIPE_WIDTH < BIRD_X) {
        g.pipes[i].passed = true;
        g.score++;
      }
    }

    // collision
    const bL = BIRD_X + HITBOX_SHRINK;
    const bR = BIRD_X + BIRD_SIZE - HITBOX_SHRINK;
    const bT = g.birdY + HITBOX_SHRINK;
    const bB = g.birdY + BIRD_SIZE - HITBOX_SHRINK;

    const hitGround = bB >= playH;
    const hitCeil   = bT <= 0;
    let   hitPipe   = false;
    for (const p of g.pipes) {
      if (bR <= p.x || bL >= p.x + PIPE_WIDTH) continue;
      const gTop = p.gapY - PIPE_GAP / 2;
      const gBot = p.gapY + PIPE_GAP / 2;
      if (bT < gTop || bB > gBot) { hitPipe = true; break; }
    }

    if (hitGround || hitCeil || hitPipe) {
      if (hitGround) g.birdY = playH - BIRD_SIZE;
      g.phase = 'dead';
      if (g.score > g.bestScore) {
        g.bestScore = g.score;
      }
      recordFlappyBirdGame(g.score);
      rerender();
      return;
    }

    rerender();
    rafId.current = requestAnimationFrame(loop);
  }, [rerender]);

  const stopLoop = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  const startGame = useCallback(() => {
    const g = G.current;
    const { H } = dims.current;
    stopLoop();
    g.phase = 'playing';
    g.birdY = (H - GROUND_H) / 2 - 60;
    g.birdVel = JUMP_VEL;
    g.birdRot = -30;
    g.pipes = [];
    g.score = 0;
    g.frame = 0;
    rerender();
    rafId.current = requestAnimationFrame(loop);
  }, [stopLoop, loop, rerender]);

  const handleTap = useCallback(() => {
    const g = G.current;
    if (g.phase === 'idle') { startGame(); return; }
    if (g.phase === 'dead') {
      g.phase = 'idle';
      g.birdY = (dims.current.H - GROUND_H) / 2;
      g.birdVel = 0;
      g.birdRot = 0;
      g.pipes = [];
      g.score = 0;
      rerender();
      return;
    }
    G.current.birdVel = JUMP_VEL;
  }, [startGame, rerender]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    dims.current = { W: width, H: height };
    if (G.current.phase === 'idle') {
      G.current.birdY = (height - GROUND_H) / 2;
      rerender();
    }
  }, [rerender]);

  const g = G.current;
  const playH = dims.current.H - GROUND_H;
  const isNewRecord = g.phase === 'dead' && g.score > 0 && g.score >= g.bestScore;

  return (
    <>
      <Stack.Screen
        options={{
          title: '플래피 버드',
          headerStyle: { backgroundColor: '#0D1B2A' },
          headerTintColor: '#fff',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => { stopLoop(); router.replace('/'); }}
              style={{ paddingHorizontal: 8 }}
            >
              <Ionicons name="home-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowLeaderboard(true)}
              style={{ paddingHorizontal: 8 }}
            >
              <Text style={{ fontSize: 22 }}>🏆</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <TouchableOpacity
        style={styles.gameArea}
        onPress={handleTap}
        activeOpacity={1}
        onLayout={handleLayout}
      >
        {/* pipes */}
        {g.pipes.map(pipe => {
          const topH = pipe.gapY - PIPE_GAP / 2;
          const botY = pipe.gapY + PIPE_GAP / 2;
          const botH = playH - botY;
          return (
            <React.Fragment key={pipe.id}>
              {topH > 0 && (
                <>
                  <View style={[styles.pipe, { left: pipe.x, top: 0, width: PIPE_WIDTH, height: topH }]} />
                  <View style={[styles.pipeCap, {
                    left: pipe.x - PIPE_CAP_EXTRA,
                    top: topH - PIPE_CAP_H,
                    width: PIPE_WIDTH + PIPE_CAP_EXTRA * 2,
                    height: PIPE_CAP_H,
                  }]} />
                </>
              )}
              {botH > 0 && (
                <>
                  <View style={[styles.pipe, { left: pipe.x, top: botY, width: PIPE_WIDTH, height: botH }]} />
                  <View style={[styles.pipeCap, {
                    left: pipe.x - PIPE_CAP_EXTRA,
                    top: botY,
                    width: PIPE_WIDTH + PIPE_CAP_EXTRA * 2,
                    height: PIPE_CAP_H,
                  }]} />
                </>
              )}
            </React.Fragment>
          );
        })}

        {/* ground */}
        <View style={[styles.ground, { top: playH, height: GROUND_H + insets.bottom }]}>
          <View style={styles.groundLine} />
        </View>

        {/* bird */}
        <View style={[
          styles.bird,
          { left: BIRD_X, top: g.birdY, transform: [{ rotate: `${g.birdRot}deg` }] },
        ]}>
          <Text style={styles.birdEmoji}>🐥</Text>
        </View>

        {/* score (playing) */}
        {g.phase === 'playing' && (
          <View style={styles.scoreBox} pointerEvents="none">
            <Text style={styles.scoreText}>{g.score}</Text>
          </View>
        )}

        {/* idle overlay */}
        {g.phase === 'idle' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>플래피 버드</Text>
            <Text style={styles.overlayHint}>탭해서 날아올라요 🐥</Text>
            {g.bestScore > 0 && (
              <Text style={styles.overlayBest}>최고 기록  {g.bestScore}</Text>
            )}
            <View style={styles.tapBtn}>
              <Text style={styles.tapBtnText}>▶  시작</Text>
            </View>
          </View>
        )}

        {/* dead overlay */}
        {g.phase === 'dead' && (
          <View style={styles.overlay}>
            <Text style={styles.overlayEmoji}>{isNewRecord ? '🏆' : '💀'}</Text>
            <Text style={styles.overlayTitle}>게임 오버</Text>
            <Text style={styles.deadScore}>{g.score}점</Text>
            {isNewRecord && <Text style={styles.newRecord}>🎉 최고 기록 갱신!</Text>}
            {g.bestScore > 0 && !isNewRecord && (
              <Text style={styles.overlayBest}>최고  {g.bestScore}점</Text>
            )}
            <View style={styles.tapBtn}>
              <Text style={styles.tapBtnText}>🔄  다시 하기</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* leaderboard modal */}
      <Modal
        visible={showLeaderboard}
        animationType="slide"
        onRequestClose={() => setShowLeaderboard(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>플래피 버드 랭킹</Text>
            <TouchableOpacity onPress={() => setShowLeaderboard(false)}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          <LeaderboardView
            gameType="flappy-bird"
            valueFormatter={(v) => `${v}점`}
            accentColor="#FDD835"
            isLoggedIn={isLoggedIn}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  gameArea: {
    flex: 1,
    backgroundColor: '#0D1B2A',
    overflow: 'hidden',
  },
  pipe: {
    position: 'absolute',
    backgroundColor: '#388E3C',
  },
  pipeCap: {
    position: 'absolute',
    backgroundColor: '#2E7D32',
    borderRadius: 4,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#1B3A1C',
  },
  groundLine: {
    height: 3,
    backgroundColor: '#4CAF50',
    opacity: 0.6,
  },
  bird: {
    position: 'absolute',
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  birdEmoji: {
    fontSize: 28,
    lineHeight: 36,
  },
  scoreBox: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scoreText: {
    color: '#fff',
    fontSize: 52,
    fontWeight: 'bold',
    textShadow: '1px 2px 4px rgba(0,0,0,0.6)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  overlayEmoji: {
    fontSize: 56,
    marginBottom: 4,
  },
  overlayTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  overlayHint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    marginTop: 4,
  },
  overlayBest: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  deadScore: {
    color: '#FDD835',
    fontSize: 52,
    fontWeight: 'bold',
    marginTop: 4,
  },
  newRecord: {
    color: '#A5D6A7',
    fontSize: 17,
    fontWeight: '700',
  },
  tapBtn: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  tapBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A4A',
  },
  modalTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
