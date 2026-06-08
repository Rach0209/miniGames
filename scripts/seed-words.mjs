/**
 * 단어 목록 시드 스크립트
 * 실행: node scripts/seed-words.mjs
 * 필요 env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

import pkg from 'xlsx';
const { readFile: xlsReadFile, utils } = pkg;
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── 자모 분해 (utils/jamo.ts 로직 복제) ──────────────────────────────────
const CHOSUNG  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNGSUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONGSUNG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const COMPOUND_EXPANSION = {
  'ㅐ':['ㅏ','ㅣ'], 'ㅒ':['ㅑ','ㅣ'], 'ㅔ':['ㅓ','ㅣ'], 'ㅖ':['ㅕ','ㅣ'],
  'ㅘ':['ㅗ','ㅏ'], 'ㅙ':['ㅗ','ㅏ','ㅣ'], 'ㅚ':['ㅗ','ㅣ'],
  'ㅝ':['ㅜ','ㅓ'], 'ㅞ':['ㅜ','ㅓ','ㅣ'], 'ㅟ':['ㅜ','ㅣ'],
  'ㅢ':['ㅡ','ㅣ'],
};
const DOUBLE_CONSONANTS = new Set(['ㄲ','ㄸ','ㅃ','ㅆ','ㅉ']);

function decomposeChar(char) {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return [char];
  const cho  = Math.floor(code / (21 * 28));
  const jung = Math.floor((code % (21 * 28)) / 28);
  const jong = code % 28;
  const result = [CHOSUNG[cho], JUNGSUNG[jung]];
  if (jong > 0) result.push(JONGSUNG[jong]);
  return result;
}

function decomposeToKeystrokes(word) {
  return Array.from(word)
    .flatMap(c => decomposeChar(c))
    .flatMap(j => COMPOUND_EXPANSION[j] ?? [j]);
}

function isValidWord(word) {
  // 2글자 한글만
  if ([...word].length !== 2) return false;
  if (!/^[가-힣]{2}$/.test(word)) return false;
  try {
    const ks = decomposeToKeystrokes(word);
    // 정확히 5 키스트로크
    if (ks.length !== 5) return false;
    // 쌍자음 없음 (키보드에 없음)
    if (ks.some(k => DOUBLE_CONSONANTS.has(k))) return false;
    return true;
  } catch {
    return false;
  }
}

// ── XLS 파싱 ─────────────────────────────────────────────────────────────
function parseXls(filePath) {
  const wb = xlsReadFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = utils.sheet_to_json(ws, { header: 1 });
  const words = [];
  for (let i = 1; i < rows.length; i++) {
    const [, rawWord, pos] = rows[i];
    if (!rawWord || !pos) continue;
    if (String(pos).trim() !== '명') continue;
    // "가격03" → "가격" (숫자 접미사 제거)
    const word = String(rawWord).replace(/\d+$/, '').trim();
    words.push(word);
  }
  return words;
}

// ── CSV 파싱 ─────────────────────────────────────────────────────────────
async function parseCsv(filePath) {
  return new Promise((resolve) => {
    const words = [];
    const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
    let header = true;
    rl.on('line', (line) => {
      if (header) { header = false; return; }
      // 컬럼: 단어장고유번호,단어명,...,품사,...
      const cols = line.split(',');
      const word = cols[1]?.trim();
      const pos  = cols[6]?.trim();
      if (!word) return;
      // 품사 없는 행도 포함 (CSV는 품사 누락 많음), 단 품사 있으면 명사만
      if (pos && pos !== '명사') return;
      words.push(word);
    });
    rl.on('close', () => resolve(words));
  });
}

// ── 메인 ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('📖 파일 읽는 중...');
  const xlsWords = parseXls('C:/Users/user/Downloads/한국어 학습용 어휘 목록.xls');
  const csvWords = await parseCsv('C:/Users/user/Downloads/한국교육학술정보원_모두의한국어_단어장_20240823.csv');

  console.log(`XLS 원본: ${xlsWords.length}개, CSV 원본: ${csvWords.length}개`);

  const all = [...xlsWords, ...csvWords];
  const filtered = [...new Set(all.filter(isValidWord))];
  filtered.sort();

  console.log(`✅ 필터 후: ${filtered.length}개`);
  console.log('샘플:', filtered.slice(0, 10));

  if (filtered.length === 0) {
    console.error('단어가 없어요. 필터 조건을 확인하세요.');
    process.exit(1);
  }

  console.log('\n📤 Supabase에 업로드 중...');
  const rows = filtered.map(word => ({
    word,
    keystroke_count: decomposeToKeystrokes(word).length,
  }));

  const { error } = await supabase
    .from('word_pool')
    .upsert(rows, { onConflict: 'word' });

  if (error) {
    console.error('❌ 업로드 실패:', error.message);
    process.exit(1);
  }

  console.log(`🎉 완료! ${filtered.length}개 단어 저장됨`);
}

main();
