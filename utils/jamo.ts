const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNGSUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONGSUNG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

export function decomposeChar(char: string): string[] {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) {
    // not a composed Korean character — return as-is (jamo)
    return [char];
  }
  const cho = Math.floor(code / (21 * 28));
  const jung = Math.floor((code % (21 * 28)) / 28);
  const jong = code % 28;
  const result = [CHOSUNG[cho], JUNGSUNG[jung]];
  if (jong > 0) result.push(JONGSUNG[jong]);
  return result;
}

export function decomposeWord(word: string): string[] {
  return Array.from(word).flatMap(decomposeChar);
}

// 합성모음을 기본 키스트로크로 확장 (ㅐ→[ㅏ,ㅣ], ㅔ→[ㅓ,ㅣ] 등)
const COMPOUND_EXPANSION: Record<string, string[]> = {
  'ㅐ': ['ㅏ','ㅣ'], 'ㅒ': ['ㅑ','ㅣ'], 'ㅔ': ['ㅓ','ㅣ'], 'ㅖ': ['ㅕ','ㅣ'],
  'ㅘ': ['ㅗ','ㅏ'], 'ㅙ': ['ㅗ','ㅏ','ㅣ'], 'ㅚ': ['ㅗ','ㅣ'],
  'ㅝ': ['ㅜ','ㅓ'], 'ㅞ': ['ㅜ','ㅓ','ㅣ'], 'ㅟ': ['ㅜ','ㅣ'],
  'ㅢ': ['ㅡ','ㅣ'],
};

// 단어를 실제 키스트로크 배열로 분해 (합성모음은 여러 칸으로 확장)
export function decomposeToKeystrokes(word: string): string[] {
  return decomposeWord(word).flatMap(j => COMPOUND_EXPANSION[j] ?? [j]);
}
