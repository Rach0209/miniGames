import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import GameBoard from '../../components/GameBoard';
import JamoKeyboard from '../../components/JamoKeyboard';
import StatsModal from '../../components/StatsModal';
import { evaluateGuess, isValidKeystroke, TileStatus } from '../../utils/gameLogic';
import { decomposeToKeystrokes } from '../../utils/jamo';
import { updateStats, GameStats, loadStats } from '../../utils/storage';
import { getTodayWord } from '../../constants/wordList';

const WORD_LENGTH = 5;
const MAX_TRIES = 5;

export default function JamoWordleScreen() {
  const todayWord = getTodayWord();
  const answerJamo = decomposeToKeystrokes(todayWord);

  const [guesses, setGuesses] = useState<string[][]>([]);
  const [statuses, setStatuses] = useState<TileStatus[][]>([]);
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<GameStats>({ totalGames: 0, wins: 0, currentStreak: 0, maxStreak: 0, distribution: [0,0,0,0,0] });
  const [keyStatuses, setKeyStatuses] = useState<Record<string, TileStatus>>({});
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { loadStats().then(setStats); }, []);

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
      if (isWon) {
        setWon(true);
        setGameOver(true);
        updateStats(true, newGuesses.length).then(s => {
          setStats(s);
          setTimeout(() => setShowStats(true), 800);
        });
      } else if (newGuesses.length >= MAX_TRIES) {
        setGameOver(true);
        updateStats(false, newGuesses.length).then(s => {
          setStats(s);
          setTimeout(() => setShowStats(true), 800);
        });
      }
      return;
    }

    if (currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(prev => [...prev, key]);
    }
  }, [gameOver, currentGuess, guesses, statuses, answerJamo, updateKeyStatuses]);

  return (
    <>
      <Stack.Screen options={{ title: '단어 맞추기 게임' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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

        <StatsModal
          visible={showStats}
          onClose={() => setShowStats(false)}
          stats={stats}
          won={won}
          attempts={guesses.length}
          answer={todayWord}
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
});
