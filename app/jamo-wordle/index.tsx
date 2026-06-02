import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Stack } from 'expo-router';
import GameBoard from '../../components/GameBoard';
import JamoKeyboard from '../../components/JamoKeyboard';
import StatsModal from '../../components/StatsModal';
import { evaluateGuess, TileStatus } from '../../utils/gameLogic';
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

  useEffect(() => {
    loadStats().then(setStats);
  }, []);

  const updateKeyStatuses = useCallback((guess: string[], result: TileStatus[]) => {
    setKeyStatuses(prev => {
      const next = { ...prev };
      const priority: Record<TileStatus, number> = { correct: 3, present: 2, absent: 1, empty: 0, active: 0 };
      guess.forEach((jamo, i) => {
        const cur = next[jamo];
        if (!cur || priority[result[i]] > priority[cur]) {
          next[jamo] = result[i];
        }
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
        Alert.alert('입력 오류', `${WORD_LENGTH}개의 자모를 입력해주세요.`);
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
      <Stack.Screen options={{ title: '자모 워들' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.hint}>
            오늘의 단어: <Text style={styles.hintJamo}>{answerJamo.join(' ')}</Text>
          </Text>
          <Text style={styles.hintSub}>↑ 힌트 (자모 순서는 같아요)</Text>
        </View>

        <GameBoard
          guesses={guesses}
          statuses={statuses}
          currentGuess={currentGuess}
          currentRow={guesses.length}
          wordLength={WORD_LENGTH}
          gameOver={gameOver}
        />

        {gameOver && (
          <Text style={styles.gameOverText}>
            {won ? '🎉 정답!' : `😢 정답은 "${todayWord}" 이었어요`}
          </Text>
        )}

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
  header: {
    alignItems: 'center',
    marginBottom: 4,
  },
  hint: {
    color: '#818384',
    fontSize: 14,
  },
  hintJamo: {
    color: '#538D4E',
    fontWeight: 'bold',
  },
  hintSub: {
    color: '#3A3A3C',
    fontSize: 11,
    marginTop: 2,
  },
  gameOverText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 8,
    textAlign: 'center',
  },
});
