export type TileStatus = 'correct' | 'present' | 'absent' | 'empty' | 'active';

const CONSONANTS = new Set(['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']);
const VOWELS = new Set(['ㅏ','ㅑ','ㅓ','ㅕ','ㅗ','ㅛ','ㅜ','ㅠ','ㅡ','ㅣ']);
const VOWEL_COMBO: Record<string, Record<string, string>> = {
  'ㅏ':{'ㅣ':'ㅐ'}, 'ㅑ':{'ㅣ':'ㅒ'}, 'ㅓ':{'ㅣ':'ㅔ'}, 'ㅕ':{'ㅣ':'ㅖ'},
  'ㅗ':{'ㅏ':'ㅘ','ㅣ':'ㅚ'}, 'ㅜ':{'ㅓ':'ㅝ','ㅣ':'ㅟ'}, 'ㅡ':{'ㅣ':'ㅢ'},
};

// 키스트로크 배열이 올바른 한국어 음절 하나를 이루는지 확인 (2~3칸)
function isValidSyllable(keys: string[]): boolean {
  if (keys.length < 2 || keys.length > 3) return false;
  if (!CONSONANTS.has(keys[0])) return false;   // 초성
  if (!VOWELS.has(keys[1])) return false;        // 중성 첫 자
  if (keys.length === 2) return true;            // C+V
  // 3칸: C+V+C(받침) 또는 C+V+V(합성모음)
  if (CONSONANTS.has(keys[2])) return true;
  if (VOWELS.has(keys[2])) return !!VOWEL_COMBO[keys[1]]?.[keys[2]];
  return false;
}

// 5칸 입력이 유효한 2음절 구조인지 검사 (자음만/모음만/엉터리 방지)
export function isValidKeystroke(keys: string[]): boolean {
  if (keys.length !== 5) return false;
  return (
    (isValidSyllable(keys.slice(0, 2)) && isValidSyllable(keys.slice(2))) ||
    (isValidSyllable(keys.slice(0, 3)) && isValidSyllable(keys.slice(3)))
  );
}

export function evaluateGuess(guess: string[], answer: string[]): TileStatus[] {
  const result: TileStatus[] = Array(5).fill('absent');
  const answerCopy = [...answer];
  const guessCopy = [...guess];

  // first pass: mark correct
  for (let i = 0; i < 5; i++) {
    if (guessCopy[i] === answerCopy[i]) {
      result[i] = 'correct';
      answerCopy[i] = '';
      guessCopy[i] = '';
    }
  }

  // second pass: mark present
  for (let i = 0; i < 5; i++) {
    if (guessCopy[i] === '') continue;
    const idx = answerCopy.indexOf(guessCopy[i]);
    if (idx !== -1) {
      result[i] = 'present';
      answerCopy[idx] = '';
    }
  }

  return result;
}
