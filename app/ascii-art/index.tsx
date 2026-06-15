import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getArtResults, type ArtResult } from '../../utils/asciiArt';

function copyText(text: string, onDone: () => void) {
  if (Platform.OS === 'web') {
    navigator.clipboard.writeText(text).then(onDone);
  }
}

function ResultCard({ item }: { item: ArtResult }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyText(item.value, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{item.label}</Text>
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
          <Text style={styles.copyBtnText}>{copied ? '✅ 복사됨' : '복사'}</Text>
        </TouchableOpacity>
      </View>
      {item.scrollX ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text style={[styles.resultText, styles.monoText]} selectable>
            {item.value}
          </Text>
        </ScrollView>
      ) : (
        <Text style={[styles.resultText, item.mono && styles.monoText]} selectable>
          {item.value}
        </Text>
      )}
    </View>
  );
}

export default function AsciiArtScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');

  const results = useMemo(() => getArtResults(input), [input]);

  return (
    <>
      <Stack.Screen
        options={{
          title: '텍스트 아트',
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
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>✨ 텍스트 아트</Text>
        <Text style={styles.subtitle}>텍스트를 입력하면 다양한 스타일로 변환해드려요</Text>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="텍스트를 입력하세요..."
            placeholderTextColor="#555"
            value={input}
            onChangeText={setInput}
            maxLength={30}
            autoCapitalize="none"
          />
          {input.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => setInput('')}>
              <Ionicons name="close-circle" size={20} color="#555" />
            </TouchableOpacity>
          )}
        </View>

        {input.trim() === '' ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✏️</Text>
            <Text style={styles.emptyText}>위에 텍스트를 입력해보세요</Text>
            <Text style={styles.emptyHint}>영문, 숫자, 특수문자 지원</Text>
          </View>
        ) : (
          results.map(item => <ResultCard key={item.id} item={item} />)
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#121213' },
  container: { flexGrow: 1, padding: 20, paddingTop: 32 },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#818384', fontSize: 13, marginBottom: 24 },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1B',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    paddingVertical: 14,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  clearBtn: { padding: 4 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#818384', fontSize: 16, marginBottom: 6 },
  emptyHint: { color: '#555', fontSize: 13 },

  card: {
    backgroundColor: '#1A1A1B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: { color: '#818384', fontSize: 13, fontWeight: '600' },
  copyBtn: {
    backgroundColor: '#2a2a2b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  copyBtnText: { color: '#fff', fontSize: 12 },
  resultText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  monoText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier New',
    fontSize: 13,
    lineHeight: 20,
  },
});
