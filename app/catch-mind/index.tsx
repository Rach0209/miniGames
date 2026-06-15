import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  PanResponder,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { onAuthStateChange } from '../../utils/supabase';
import {
  submitDrawing,
  getRandomDrawing,
  submitGuess,
  getMyDrawings,
  deleteDrawing,
  getMyStats,
  type StrokePath,
  type Drawing,
} from '../../utils/catchMindStorage';
import type { User } from '@supabase/supabase-js';

type Mode = 'select' | 'draw' | 'guess' | 'my';
type DrawTool = 'pen' | 'eraser';

const COLORS = ['#fff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#000'];
const WIDTHS = [2, 4, 8, 14];
const CANVAS_W = 320;
const CANVAS_H = 320;

function pathsToSvgD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M${points[0].x},${points[0].y} l0,0`;
  }
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
}

// ─── Drawing Canvas ──────────────────────────────────────────────────────────

function DrawingCanvas({
  paths,
  onPathsChange,
  readonly = false,
}: {
  paths: StrokePath[];
  onPathsChange?: (p: StrokePath[]) => void;
  readonly?: boolean;
}) {
  const currentStroke = useRef<{ x: number; y: number }[]>([]);
  const [activePath, setActivePath] = useState<StrokePath | null>(null);
  const colorRef = useRef('#fff');
  const widthRef = useRef(4);
  const toolRef = useRef<DrawTool>('pen');
  const [selectedColor, setSelectedColor] = useState('#fff');
  const [selectedWidth, setSelectedWidth] = useState(4);
  const [selectedTool, setSelectedTool] = useState<DrawTool>('pen');
  const canvasRef = useRef<View>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pathsRef = useRef<StrokePath[]>(paths);
  const onPathsChangeRef = useRef(onPathsChange);

  useEffect(() => { pathsRef.current = paths; }, [paths]);
  useEffect(() => { onPathsChangeRef.current = onPathsChange; }, [onPathsChange]);

  const measureCanvas = useCallback(() => {
    canvasRef.current?.measure((_x, _y, _w, _h, px, py) => {
      offsetRef.current = { x: px, y: py };
    });
  }, []);

  const setColor = (c: string) => {
    colorRef.current = c;
    setSelectedColor(c);
    setSelectedTool('pen');
    toolRef.current = 'pen';
  };
  const setWidth = (w: number) => {
    widthRef.current = w;
    setSelectedWidth(w);
  };
  const setTool = (t: DrawTool) => {
    toolRef.current = t;
    setSelectedTool(t);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !readonly,
      onMoveShouldSetPanResponder: () => !readonly,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStroke.current = [{ x: locationX, y: locationY }];
        setActivePath({
          color: toolRef.current === 'eraser' ? '#1A1A1B' : colorRef.current,
          width: toolRef.current === 'eraser' ? 24 : widthRef.current,
          points: [{ x: locationX, y: locationY }],
        });
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentStroke.current.push({ x: locationX, y: locationY });
        setActivePath((prev) =>
          prev ? { ...prev, points: [...currentStroke.current] } : null
        );
      },
      onPanResponderRelease: () => {
        if (currentStroke.current.length === 0) return;
        const newPath: StrokePath = {
          color: toolRef.current === 'eraser' ? '#1A1A1B' : colorRef.current,
          width: toolRef.current === 'eraser' ? 24 : widthRef.current,
          points: [...currentStroke.current],
        };
        onPathsChangeRef.current?.([...pathsRef.current, newPath]);
        currentStroke.current = [];
        setActivePath(null);
      },
    })
  ).current;

  if (readonly) {
    return (
      <View style={styles.canvasWrapper}>
        <View style={[styles.canvas, { width: CANVAS_W, height: CANVAS_H }]}>
          <Svg width={CANVAS_W} height={CANVAS_H}>
            {paths.map((stroke, i) => (
              <Path
                key={i}
                d={pathsToSvgD(stroke.points)}
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.canvasSection}>
      {/* 색상 팔레트 */}
      <View style={styles.palette}>
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              styles.colorDot,
              { backgroundColor: c },
              selectedColor === c && selectedTool === 'pen' && styles.colorDotSelected,
            ]}
            onPress={() => setColor(c)}
          />
        ))}
      </View>

      {/* 굵기 + 도구 */}
      <View style={styles.toolRow}>
        {WIDTHS.map((w) => (
          <TouchableOpacity
            key={w}
            style={[styles.widthBtn, selectedWidth === w && styles.widthBtnSelected]}
            onPress={() => setWidth(w)}
          >
            <View style={[styles.widthDot, { width: w * 2, height: w * 2, borderRadius: w }]} />
          </TouchableOpacity>
        ))}
        <View style={styles.toolSep} />
        <TouchableOpacity
          style={[styles.toolBtn, selectedTool === 'eraser' && styles.toolBtnSelected]}
          onPress={() => setTool('eraser')}
        >
          <Text style={styles.toolBtnText}>지우개</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={() => onPathsChangeRef.current?.([])}
        >
          <Text style={[styles.toolBtnText, { color: '#ef4444' }]}>전체 지우기</Text>
        </TouchableOpacity>
      </View>

      {/* 캔버스 */}
      <View
        ref={canvasRef}
        onLayout={measureCanvas}
        style={[styles.canvas, { width: CANVAS_W, height: CANVAS_H }]}
        {...panResponder.panHandlers}
      >
        <Svg width={CANVAS_W} height={CANVAS_H} style={StyleSheet.absoluteFill}>
          {paths.map((stroke, i) => (
            <Path
              key={i}
              d={pathsToSvgD(stroke.points)}
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {activePath && (
            <Path
              d={pathsToSvgD(activePath.points)}
              stroke={activePath.color}
              strokeWidth={activePath.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </Svg>
      </View>
    </View>
  );
}

// ─── 출제 모드 ────────────────────────────────────────────────────────────────

function DrawMode({ onBack }: { onBack: () => void }) {
  const [paths, setPaths] = useState<StrokePath[]>([]);
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (paths.length === 0) {
      Alert.alert('알림', '그림을 그려주세요!');
      return;
    }
    if (!answer.trim()) {
      Alert.alert('알림', '정답 단어를 입력해주세요!');
      return;
    }
    setSubmitting(true);
    try {
      await submitDrawing(answer, hint, paths);
      Alert.alert('완료!', '그림이 출제됐어요. 다른 사람들이 맞춰볼 거예요!', [
        { text: '확인', onPress: onBack },
      ]);
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.modeContainer}
      contentContainerStyle={styles.modeContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.modeTitle}>✏️ 그림 출제</Text>
      <Text style={styles.modeDesc}>그림을 그리고 정답을 입력해 출제하세요</Text>

      <DrawingCanvas paths={paths} onPathsChange={setPaths} />

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>정답 단어 *</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 사과, 자전거, 강아지..."
          placeholderTextColor="#555"
          value={answer}
          onChangeText={setAnswer}
          maxLength={20}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>힌트 (선택)</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 과일, 탈것, 동물..."
          placeholderTextColor="#555"
          value={hint}
          onChangeText={setHint}
          maxLength={30}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>출제하기</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← 뒤로</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── 풀기 모드 ────────────────────────────────────────────────────────────────

type GuessPhase = 'loading' | 'playing' | 'correct' | 'skip' | 'empty';

function GuessMode({ onBack }: { onBack: () => void }) {
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [phase, setPhase] = useState<GuessPhase>('loading');
  const [guess, setGuess] = useState('');
  const [wrong, setWrong] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);

  const loadNext = useCallback(async () => {
    setPhase('loading');
    setGuess('');
    setWrong(false);
    setShowAnswer(false);
    setWrongCount(0);
    try {
      const d = await getRandomDrawing();
      if (!d) {
        setPhase('empty');
        return;
      }
      setDrawing(d);
      setPhase('playing');
    } catch (e: any) {
      Alert.alert('오류', e.message);
      setPhase('empty');
    }
  }, []);

  useEffect(() => {
    loadNext();
  }, []);

  const handleGuess = async () => {
    if (!drawing || !guess.trim()) return;
    setSubmitting(true);
    try {
      const correct = await submitGuess(drawing.id, guess, drawing.answer);
      if (correct) {
        setPhase('correct');
      } else {
        setWrong(true);
        setWrongCount((c) => c + 1);
        setGuess('');
      }
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const hintText = drawing?.hint
    ? `카테고리: ${drawing.hint} · ${drawing.answer.length}글자`
    : `${drawing?.answer.length ?? 0}글자`;

  if (phase === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={[styles.modeDesc, { marginTop: 16 }]}>그림 불러오는 중...</Text>
      </View>
    );
  }

  if (phase === 'empty') {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>🎨</Text>
        <Text style={styles.emptyTitle}>풀 문제가 없어요</Text>
        <Text style={styles.emptyDesc}>아직 출제된 그림이 없거나{'\n'}모두 맞췄어요!</Text>
        <TouchableOpacity style={styles.submitBtn} onPress={loadNext}>
          <Text style={styles.submitBtnText}>다시 확인</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← 뒤로</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'correct') {
    return (
      <View style={styles.centered}>
        <Text style={styles.correctEmoji}>🎉</Text>
        <Text style={styles.correctTitle}>정답!</Text>
        <Text style={styles.correctAnswer}>"{drawing?.answer}"</Text>
        <Text style={styles.modeDesc}>{wrongCount}번 틀린 후 맞췄어요</Text>
        <DrawingCanvas paths={drawing?.paths ?? []} readonly />
        <TouchableOpacity style={[styles.submitBtn, { marginTop: 24 }]} onPress={loadNext}>
          <Text style={styles.submitBtnText}>다음 문제</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← 뒤로</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.modeContainer}
      contentContainerStyle={styles.modeContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.modeTitle}>🔍 그림 맞추기</Text>
      <Text style={styles.hintText}>{hintText}</Text>

      {showAnswer ? (
        <View style={styles.answerReveal}>
          <Text style={styles.answerRevealLabel}>정답</Text>
          <Text style={styles.answerRevealText}>{drawing?.answer}</Text>
        </View>
      ) : null}

      <DrawingCanvas paths={drawing?.paths ?? []} readonly />

      {wrong && (
        <View style={styles.wrongBanner}>
          <Text style={styles.wrongText}>틀렸어요! 다시 도전해보세요 ({wrongCount}번 틀림)</Text>
        </View>
      )}

      <View style={styles.guessRow}>
        <TextInput
          style={styles.guessInput}
          placeholder="정답을 입력하세요..."
          placeholderTextColor="#555"
          value={guess}
          onChangeText={(t) => { setGuess(t); setWrong(false); }}
          onSubmitEditing={handleGuess}
          returnKeyType="done"
          editable={!showAnswer}
        />
        <TouchableOpacity
          style={[styles.guessBtn, (!guess.trim() || submitting || showAnswer) && styles.guessBtnDisabled]}
          onPress={handleGuess}
          disabled={!guess.trim() || submitting || showAnswer}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.guessBtnText}>제출</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        {!showAnswer && (
          <TouchableOpacity style={styles.skipBtn} onPress={() => setShowAnswer(true)}>
            <Text style={styles.skipBtnText}>정답 보기</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.skipBtn} onPress={loadNext}>
          <Text style={styles.skipBtnText}>다음 문제 →</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← 뒤로</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── 내 출제 현황 ─────────────────────────────────────────────────────────────

function MyDrawingsMode({ onBack }: { onBack: () => void }) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [stats, setStats] = useState<{ drawingCount: number; guessCount: number; correctCount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([getMyDrawings(), getMyStats()]);
      setDrawings(d);
      setStats(s);
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleDelete = (id: string, answer: string) => {
    Alert.alert('삭제 확인', `"${answer}" 그림을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDrawing(id);
            setDrawings((prev) => prev.filter((d) => d.id !== id));
            setStats((prev) => prev ? { ...prev, drawingCount: prev.drawingCount - 1 } : prev);
          } catch (e: any) {
            Alert.alert('오류', e.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={[styles.modeDesc, { marginTop: 16 }]}>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.modeContainer} contentContainerStyle={styles.modeContent}>
      <Text style={styles.modeTitle}>📋 내 출제 현황</Text>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.drawingCount}</Text>
            <Text style={styles.statLabel}>출제한 그림</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.guessCount}</Text>
            <Text style={styles.statLabel}>총 시도</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#22c55e' }]}>{stats.correctCount}</Text>
            <Text style={styles.statLabel}>정답 맞춤</Text>
          </View>
        </View>
      )}

      {drawings.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🖼️</Text>
          <Text style={styles.emptyTitle}>출제한 그림이 없어요</Text>
          <Text style={styles.emptyDesc}>그림을 그려서 출제해보세요!</Text>
        </View>
      ) : (
        drawings.map((d) => (
          <View key={d.id} style={styles.drawingCard}>
            <View style={styles.drawingCardHeader}>
              <View>
                <Text style={styles.drawingAnswer}>{d.answer}</Text>
                {d.hint ? <Text style={styles.drawingHint}>힌트: {d.hint}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleDelete(d.id, d.answer)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>삭제</Text>
              </TouchableOpacity>
            </View>
            <DrawingCanvas paths={d.paths} readonly />
          </View>
        ))
      )}

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← 뒤로</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export default function CatchMindScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>('select');
  const insets = useSafeAreaInsets();

  const homeHeaderLeft = () => (
    <TouchableOpacity onPress={() => router.replace('/')} style={{ paddingHorizontal: 8 }}>
      <Ionicons name="home-outline" size={22} color="#fff" />
    </TouchableOpacity>
  );

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((u) => setUser(u));
    return () => subscription.unsubscribe();
  }, []);

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: '캐치 마인드', headerLeft: homeHeaderLeft }} />
        <View style={[styles.centered, { paddingBottom: insets.bottom }]}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={styles.lockTitle}>로그인이 필요해요</Text>
          <Text style={styles.lockDesc}>홈으로 돌아가 Google 로그인 후{'\n'}이용할 수 있어요</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '캐치 마인드' }} />
      {mode === 'select' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.selectContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}
        >
          <Text style={styles.pageTitle}>🎨 캐치 마인드</Text>
          <Text style={styles.pageDesc}>그림으로 소통하는 단어 맞추기 게임</Text>

          <TouchableOpacity
            style={[styles.modeCard, styles.drawCard]}
            onPress={() => setMode('draw')}
            activeOpacity={0.85}
          >
            <Text style={styles.modeCardEmoji}>✏️</Text>
            <View style={styles.modeCardInfo}>
              <Text style={styles.modeCardTitle}>그림 출제</Text>
              <Text style={styles.modeCardDesc}>그림을 그리고 다른 사람들이 맞추게 하세요</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, styles.guessCard]}
            onPress={() => setMode('guess')}
            activeOpacity={0.85}
          >
            <Text style={styles.modeCardEmoji}>🔍</Text>
            <View style={styles.modeCardInfo}>
              <Text style={styles.modeCardTitle}>그림 맞추기</Text>
              <Text style={styles.modeCardDesc}>다른 사람이 그린 그림을 보고 정답을 맞춰보세요</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, styles.myCard]}
            onPress={() => setMode('my')}
            activeOpacity={0.85}
          >
            <Text style={styles.modeCardEmoji}>📋</Text>
            <View style={styles.modeCardInfo}>
              <Text style={styles.modeCardTitle}>내 출제 현황</Text>
              <Text style={styles.modeCardDesc}>내가 출제한 그림 목록과 통계를 확인하세요</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      )}
      {mode === 'draw' && <DrawMode onBack={() => setMode('select')} />}
      {mode === 'guess' && <GuessMode onBack={() => setMode('select')} />}
      {mode === 'my' && <MyDrawingsMode onBack={() => setMode('select')} />}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#121213' },
  selectContainer: { flexGrow: 1, padding: 24, paddingTop: 48 },
  centered: {
    flex: 1,
    backgroundColor: '#121213',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pageTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 6 },
  pageDesc: { color: '#818384', fontSize: 14, marginBottom: 36 },
  modeCard: {
    borderRadius: 14,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  drawCard: { backgroundColor: '#1a2236', borderColor: '#3b82f6' },
  guessCard: { backgroundColor: '#1e1a2e', borderColor: '#a855f7' },
  myCard: { backgroundColor: '#1a2a1a', borderColor: '#22c55e' },
  modeCardEmoji: { fontSize: 42 },
  modeCardInfo: { flex: 1 },
  modeCardTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  modeCardDesc: { color: '#818384', fontSize: 13, marginTop: 4 },

  // Lock screen
  lockEmoji: { fontSize: 56, marginBottom: 16 },
  lockTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  lockDesc: { color: '#818384', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Mode screens
  modeContainer: { flex: 1, backgroundColor: '#121213' },
  modeContent: { flexGrow: 1, padding: 20, paddingTop: 28, alignItems: 'center' },
  modeTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 4, alignSelf: 'flex-start' },
  modeDesc: { color: '#818384', fontSize: 13, marginBottom: 20, alignSelf: 'flex-start' },
  hintText: { color: '#a855f7', fontSize: 13, marginBottom: 12, alignSelf: 'flex-start', fontWeight: '600' },

  // Canvas
  canvasSection: { width: '100%', alignItems: 'center', marginBottom: 20 },
  canvasWrapper: { width: '100%', alignItems: 'center', marginBottom: 20 },
  canvas: {
    backgroundColor: '#1A1A1B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    overflow: 'hidden',
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    justifyContent: 'center',
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#3A3A3C',
  },
  colorDotSelected: {
    borderColor: '#fff',
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  widthBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthBtnSelected: { borderColor: '#fff' },
  widthDot: { backgroundColor: '#fff' },
  toolSep: { width: 1, height: 24, backgroundColor: '#3A3A3C' },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  toolBtnSelected: { borderColor: '#f97316' },
  toolBtnText: { color: '#ccc', fontSize: 12 },

  // Input
  inputGroup: { width: '100%', marginBottom: 14 },
  inputLabel: { color: '#818384', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    width: '100%',
  },

  // Guess row
  guessRow: { flexDirection: 'row', gap: 8, width: '100%', marginBottom: 12 },
  guessInput: {
    flex: 1,
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  guessBtn: {
    backgroundColor: '#a855f7',
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guessBtnDisabled: { opacity: 0.4 },
  guessBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  // Action row
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    backgroundColor: '#1A1A1B',
  },
  skipBtnText: { color: '#818384', fontSize: 13 },

  // Wrong banner
  wrongBanner: {
    backgroundColor: '#3b0808',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  wrongText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },

  // Answer reveal
  answerReveal: {
    backgroundColor: '#0f2d0f',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
  },
  answerRevealLabel: { color: '#22c55e', fontSize: 11, marginBottom: 2 },
  answerRevealText: { color: '#22c55e', fontSize: 20, fontWeight: 'bold' },

  // Correct screen
  correctEmoji: { fontSize: 64, marginBottom: 12 },
  correctTitle: { color: '#22c55e', fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
  correctAnswer: { color: '#fff', fontSize: 22, marginBottom: 8 },

  // Empty screen
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  emptyDesc: { color: '#818384', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  // Buttons
  submitBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backBtn: { paddingVertical: 10 },
  backBtnText: { color: '#818384', fontSize: 14 },

  // My drawings
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20, width: '100%' },
  statBox: {
    flex: 1,
    backgroundColor: '#1A1A1B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    padding: 12,
    alignItems: 'center',
  },
  statNum: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: '#818384', fontSize: 11, marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  drawingCard: {
    width: '100%',
    backgroundColor: '#1A1A1B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    marginBottom: 16,
    overflow: 'hidden',
  },
  drawingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  drawingAnswer: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  drawingHint: { color: '#818384', fontSize: 12, marginTop: 2 },
  deleteBtn: {
    backgroundColor: '#3b0808',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteBtnText: { color: '#ef4444', fontSize: 13 },
});
