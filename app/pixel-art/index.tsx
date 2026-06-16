import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const MIN_DOT = 8;
const MAX_DOT = 96;
const DEFAULT_DOT = 32;
const MAX_DISPLAY_PX = 480;

function PixelArtWeb() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElRef = useRef<HTMLImageElement | null>(null);

  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [dotCount, setDotCount] = useState(DEFAULT_DOT);
  const [error, setError] = useState<string | null>(null);

  // 선택한 이미지를 HTMLImageElement로 디코딩
  useEffect(() => {
    if (!imgSrc) {
      imageElRef.current = null;
      setReady(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      imageElRef.current = img;
      setReady(true);
    };
    img.onerror = () => setError('이미지를 불러올 수 없어요.');
    img.src = imgSrc;
  }, [imgSrc]);

  // 도트(픽셀) 변환 — 작은 캔버스로 다운샘플 후, 스무딩 없이 확대해서 블록 느낌을 냄
  const draw = useCallback(() => {
    const img = imageElRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const cols = w >= h ? dotCount : Math.max(1, Math.round((dotCount * w) / h));
    const rows = w >= h ? Math.max(1, Math.round((dotCount * h) / w)) : dotCount;

    const small = document.createElement('canvas');
    small.width = cols;
    small.height = rows;
    const sctx = small.getContext('2d');
    if (!sctx) return;
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(img, 0, 0, cols, rows);

    const outW = w >= h ? MAX_DISPLAY_PX : Math.round((MAX_DISPLAY_PX * w) / h);
    const outH = w >= h ? Math.round((MAX_DISPLAY_PX * h) / w) : MAX_DISPLAY_PX;

    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(small, 0, 0, cols, rows, 0, 0, outW, outH);
  }, [dotCount]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  const handleFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있어요.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`파일이 너무 커요. 최대 ${MAX_FILE_BYTES / 1024 / 1024}MB까지 지원해요.`);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result as string);
    reader.onerror = () => setError('파일을 읽는 데 실패했어요.');
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setImgSrc(null);
    setFileName(null);
    setReady(false);
    setError(null);
    setDotCount(DEFAULT_DOT);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixel-art-${Date.now()}.png`;
    a.click();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '도트 변환기',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/')} style={{ paddingHorizontal: 8 }}>
              <Ionicons name="home-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}
      >
        <Text style={styles.title}>🧱 도트 변환기</Text>
        <Text style={styles.subtitle}>이미지를 업로드하면 도트(픽셀) 아트로 바꿔드려요</Text>
        <Text style={styles.hint}>최대 {MAX_FILE_BYTES / 1024 / 1024}MB · 웹 전용 기능</Text>

        {React.createElement('input', {
          ref: fileInputRef,
          type: 'file',
          accept: 'image/*',
          style: { display: 'none' },
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleFile(e.target.files?.[0]),
        })}

        <TouchableOpacity
          style={styles.pickBtn}
          onPress={() => fileInputRef.current?.click()}
          activeOpacity={0.8}
        >
          <Ionicons name="image-outline" size={18} color="#fff" />
          <Text style={styles.pickBtnText}>{fileName ? '다른 이미지 선택' : '이미지 선택'}</Text>
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}

        {ready && (
          <View style={styles.resultBox}>
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>

            <View style={styles.canvasWrap}>
              {React.createElement('canvas', {
                ref: canvasRef,
                style: { maxWidth: '100%', height: 'auto', borderRadius: 8 },
              })}
            </View>

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>도트 크기: {dotCount}</Text>
              {React.createElement('input', {
                type: 'range',
                min: MIN_DOT,
                max: MAX_DOT,
                value: dotCount,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDotCount(Number(e.target.value)),
                style: { width: '100%' },
              })}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleDownload} activeOpacity={0.8}>
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>다운로드</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.resetBtn]} onPress={handleReset} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>다시 선택</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!ready && !error && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🖼️</Text>
            <Text style={styles.emptyText}>위에서 이미지를 선택해보세요</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function PixelArtUnsupported() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <>
      <Stack.Screen
        options={{
          title: '도트 변환기',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/')} style={{ paddingHorizontal: 8 }}>
              <Ionicons name="home-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={[styles.scroll, styles.unsupported, { paddingBottom: insets.bottom }]}>
        <Text style={styles.emptyEmoji}>🖥️</Text>
        <Text style={styles.emptyText}>이 기능은 웹 브라우저에서만 사용할 수 있어요.</Text>
        <Text style={styles.hint}>PC나 모바일 브라우저로 접속해주세요.</Text>
      </View>
    </>
  );
}

export default function PixelArtScreen() {
  if (Platform.OS !== 'web') return <PixelArtUnsupported />;
  return <PixelArtWeb />;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#121213' },
  container: { flexGrow: 1, padding: 20, paddingTop: 32 },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#818384', fontSize: 13, marginBottom: 4 },
  hint: { color: '#555', fontSize: 12, marginBottom: 20 },

  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 16,
  },
  pickBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  error: { color: '#FF6B6B', fontSize: 13, marginBottom: 12 },

  resultBox: {
    backgroundColor: '#1A1A1B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    padding: 16,
  },
  fileName: { color: '#818384', fontSize: 12, marginBottom: 12 },
  canvasWrap: { alignItems: 'center', marginBottom: 16 },

  sliderRow: { marginBottom: 16 },
  sliderLabel: { color: '#fff', fontSize: 13, marginBottom: 8 },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2a2a2b',
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  resetBtn: { backgroundColor: '#1A1A1B' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#818384', fontSize: 16, marginBottom: 6, textAlign: 'center' },

  unsupported: { alignItems: 'center', justifyContent: 'center', padding: 24 },
});
