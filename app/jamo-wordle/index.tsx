import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GameBoard from '../../components/GameBoard';
import JamoKeyboard from '../../components/JamoKeyboard';
import StatsModal from '../../components/StatsModal';
import { evaluateGuess, isValidKeystroke, TileStatus } from '../../utils/gameLogic';
import { decomposeToKeystrokes } from '../../utils/jamo';
import { updateStats, GameStats, loadStats, loadTodayStatus } from '../../utils/storage';
import { supabase } from '../../utils/supabase';
import { getTodayWord, getRandomWord } from '../../constants/wordList';

const WORD_LENGTH = 5;
const MAX_TRIES = 5;

type GameMode = 'daily' | 'free';

export default function JamoWordleScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<GameMode>('daily');
  const [targetWord, setTargetWord] = useState<string>(getTodayWord());
  const [answerJamo, setAnswerJamo] = useState<string[]>(decomposeToKeystrokes(getTodayWord()));

  const [guesses, setGuesses] = useState<string[][]>([]);
  const [statuses, setStatuses] = useState<TileStatus[][]>([]);
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<GameStats>({ totalGames: 0, wins: 0, currentStreak: 0, maxStreak: 0, distribution: [0,0,0,0,0] });
  const [keyStatuses, setKeyStatuses] = useState<Record<string, TileStatus>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [alreadyPlayedToday, setAlreadyPlayedToday] = useState(false);
  const [todayWon, setTodayWon] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showGuestNotice, setShowGuestNotice] = useState(false);

  // 초기 로딩
  useEffect(() => {
    loadStats().then(setStats);
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      if (!user) {
        setShowGuestNotice(true);
      }
    });
    loadTodayStatus().then(status => {
      if (status?.played) {
        setAlreadyPlayedToday(true);
        setTodayWon(status.won);
        setGameOver(true);
      }
    });
  }, []);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 2000);
  };

  const updateKeyStatuses = useCallback((guess: string[], result: TileStatus[]) => {
    setKeyStatuses(prev => {
      const next = { ...prev };
      const priority: Record<TileStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0, active: 0 };
      guess.forEach((jamo, i) => {
        const cur = next[jamo];
        if (!cur || priority[result[i]] > priority[cur]) next[jamo] = result[i];
      });
      return next;
    });
  }, []);

  // 자유 모드 시작
  const startFreeMode = useCallback(() => {
    const newWord = getRandomWord(targetWord);
    setMode('free');
    setTargetWord(newWord);
    setAnswerJamo(decomposeToKeystrokes(newWord));
    setGuesses([]);
    setStatuses([]);
    setCurrentGuess([]);
    setKeyStatuses({});
    setGameOver(false);
    setWon(false);
    setShowStats(false);
    setAlreadyPlayedToday(false);
  }, [targetWord]);

  const handleKey = useCallback((key: string) => {
    if (gameOver) return;

    if (key === '⌫') {
      setCurrentGuess(prev => prev.slice(0, -1));
      return;
    }

    if (key === '✓') {
      if (currentGuess.length !== WORD_LENGTH) {
        showError(`자모 ${WORD_LENGTH}개를 입력해주세요`);
        return;
      }
      if (!isValidKeystroke(currentGuess)) {
        showError('올바른 한국어 단어 형식이 아니에요');
        return;
      }

      const result = evaluateGuess(currentGuess, answerJamo);
      const newGuesses = [...guesses, currentGuess];
      const newStatuses = [...statuses, result];

      setGuesses(newGuesses);
      setStatuses(newStatuses);
      updateKeyStatuses(currentGuess, result);
      setCurrentGuess([]);

      const isWon = result.every(s => s === 'correct');
      const isOver = isWon || newGuesses.length >= MAX_TRIES;

      if (isOver) {
        setWon(isWon);
        setGameOver(true);
        if (mode === 'daily') {
          updateStats(isWon, newGuesses.length).then(s => setStats(s));
        }
        setTimeout(() => setShowStats(true), 800);
      }
      return;
    }

    if (currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(prev => [...prev, key]);
    }
  }, [gameOver, currentGuess, guesses, statuses, answerJamo, updateKeyStatuses, mode]);

  const modeLabel = mode === 'daily' ? '오늘의 단어' : '자유 모드';

  // 로그인 유저가 오늘 이미 플레이한 경우
  if (alreadyPlayedToday && mode === 'daily') {
    return (
      <>
        <Stack.Screen
          options={{
            title: `단어 맞추기 — ${modeLabel}`,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.replace('/')} style={{ paddingHorizontal: 8 }}>
                <Ionicons name="home-outline" size={22} color="#fff" />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>{todayWon ? '🎉' : '😅'}</Text>
          <Text style={styles.doneTitle}>오늘의 단어는 이미 완료했어요!</Text>
          <Text style={styles.doneSubtitle}>
            {todayWon ? '정답을 맞췄어요' : '아쉽게 실패했어요'}
          </Text>
          <TouchableOpacity style={styles.freeModeButton} onPress={startFreeMode} activeOpacity={0.8}>
            <Text style={styles.freeModeButtonText}>🎲 자유 모드로 계속하기</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `단어 맞추기 — ${modeLabel}`,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/')} style={{ paddingHorizontal: 8 }}>
              <Ionicons name="home-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.modeBadge, mode === 'free' && styles.modeBadgeFree]}>
          <Text style={styles.modeBadgeText}>{modeLabel}</Text>
        </View>

        {/* 비로그인 안내 */}
        {showGuestNotice && (
          <TouchableOpacity
            style={styles.guestNotice}
            onPress={() => setShowGuestNotice(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.guestNoticeText}>
              🔒 로그인하지 않으면 기록이 저장되지 않아요  ✕
            </Text>
          </TouchableOpacity>
        )}

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <GameBoard
          guesses={guesses}
          statuses={statuses}
          currentGuess={currentGuess}
          currentRow={guesses.length}
          wordLength={WORD_LENGTH}
        />

        <JamoKeyboard onKey={handleKey} keyStatuses={keyStatuses} />

        {gameOver && mode === 'daily' && (
          <TouchableOpacity style={styles.freeModeButton} onPress={startFreeMode} activeOpacity={0.8}>
            <Text style={styles.freeModeButtonText}>🎲 자유 모드로 계속하기</Text>
          </TouchableOpacity>
        )}

        {gameOver && mode === 'free' && (
          <TouchableOpacity style={styles.freeModeButton} onPress={startFreeMode} activeOpacity={0.8}>
            <Text style={styles.freeModeButtonText}>🔄 다음 단어</Text>
          </TouchableOpacity>
        )}

        <StatsModal
          visible={showStats}
          onClose={() => setShowStats(false)}
          stats={stats}
          won={won}
          attempts={guesses.length}
          answer={targetWord}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121213',
  },
  content: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 32,
  },
  doneContainer: {
    flex: 1,
    backgroundColor: '#121213',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  doneEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  doneTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  doneSubtitle: {
    color: '#818384',
    fontSize: 15,
    marginBottom: 16,
  },
  modeBadge: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  modeBadgeFree: {
    backgroundColor: '#1D3557',
  },
  modeBadgeText: {
    color: '#A8A8B3',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#B00020',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  freeModeButton: {
    marginTop: 20,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  freeModeButtonText: {
    color: '#4A90D9',
    fontSize: 16,
    fontWeight: '700',
  },
  guestNotice: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  guestNoticeText: {
    color: '#A8A8B3',
    fontSize: 12,
    textAlign: 'center',
  },
});
