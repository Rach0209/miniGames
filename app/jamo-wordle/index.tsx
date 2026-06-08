import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GameBoard from '../../components/GameBoard';
import JamoKeyboard from '../../components/JamoKeyboard';
import StatsModal from '../../components/StatsModal';
import { evaluateGuess, isValidKeystroke, TileStatus } from '../../utils/gameLogic';
import { decomposeToKeystrokes } from '../../utils/jamo';
import { updateStats, GameStats, loadStats, loadDailyRecord, saveDailyRecord } from '../../utils/storage';
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

  // 초기 로딩: 오늘 플레이 여부 확인
  useEffect(() => {
    loadStats().then(setStats);
    loadDailyRecord().then(record => {
      if (record?.played) {
        setAlreadyPlayedToday(true);
        setGuesses(record.guesses);
        setStatuses(record.statuses);
        setWon(record.won);
        setGameOver(true);
        setTargetWord(record.answer);
        setAnswerJamo(decomposeToKeystrokes(record.answer));
        // 키보드 색상 복원
        const ks: Record<string, TileStatus> = {};
        const priority: Record<TileStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0, active: 0 };
        record.guesses.forEach((g, i) => {
          g.forEach((jamo, j) => {
            const cur = ks[jamo];
            if (!cur || priority[record.statuses[i][j]] > priority[cur]) ks[jamo] = record.statuses[i][j];
          });
        });
        setKeyStatuses(ks);
        setTimeout(() => setShowStats(true), 300);
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
          // 통계 저장 + 일일 기록 저장
          updateStats(isWon, newGuesses.length).then(s => setStats(s));
          saveDailyRecord({
            date: new Date().toISOString().slice(0, 10),
            played: true,
            won: isWon,
            answer: targetWord,
            guesses: newGuesses,
            statuses: newStatuses,
          });
        }

        setTimeout(() => setShowStats(true), 800);
      }
      return;
    }

    if (currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(prev => [...prev, key]);
    }
  }, [gameOver, currentGuess, guesses, statuses, answerJamo, updateKeyStatuses, mode, targetWord]);

  const modeLabel = mode === 'daily' ? '오늘의 단어' : '자유 모드';

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
        {/* 모드 배지 */}
        <View style={[styles.modeBadge, mode === 'free' && styles.modeBadgeFree]}>
          <Text style={styles.modeBadgeText}>{modeLabel}</Text>
        </View>

        {/* 에러 메시지 */}
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

        {/* 자유 모드 버튼 (일일 게임 종료 후) */}
        {gameOver && mode === 'daily' && (
          <TouchableOpacity style={styles.freeModeButton} onPress={startFreeMode} activeOpacity={0.8}>
            <Text style={styles.freeModeButtonText}>🎲 자유 모드로 계속하기</Text>
          </TouchableOpacity>
        )}

        {/* 자유 모드 중: 다음 단어 버튼 */}
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
});
