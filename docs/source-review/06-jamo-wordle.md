# 자모 워들 소스 리뷰

> **파일**: `app/jamo-wordle/index.tsx`, `utils/gameLogic.ts`, `utils/jamo.ts`  
> **핵심 주제**: 한글 자모 분해, 정답 판정 알고리즘, 복합 상태 관리

---

## 게임 개요

한국어 2글자 단어를 최대 5번 안에 맞추는 워들(Wordle) 게임.  
일반 글자가 아닌 **자모(자음+모음) 단위**로 입력받는 것이 특징입니다.

예: `세수` → `ㅅ ㅓ ㅣ ㅅ ㅜ` (5칸, ㅔ=ㅓ+ㅣ 합성모음)

---

## 왜 자모 단위인가?

한글은 자음과 모음을 조합해서 글자를 만듭니다.  
예를 들어 `ㅔ`는 `ㅓ`와 `ㅣ`를 연달아 입력해야 나오므로,  
키스트로크(실제 누른 횟수)와 글자 수가 다릅니다.

```
"세수" 키스트로크: ㅅ + ㅓ + ㅣ + ㅅ + ㅜ = 5개
"국밥" 키스트로크: ㄱ + ㅜ + ㄱ + ㅂ + ㅏ + ㅂ = 6개  ← 이 게임에 안 나옴
```

5 키스트로크인 단어만 사용합니다.

---

## 한글 자모 분해 — utils/jamo.ts

```typescript
// 예: "세수" → ['ㅅ', 'ㅓ', 'ㅣ', 'ㅅ', 'ㅜ']
export function decomposeToKeystrokes(word: string): string[] { ... }
```

**유니코드 기반 분해 원리**:

한글 글자는 유니코드에서 수식으로 초성/중성/종성을 분리할 수 있습니다.

```
"가" = U+AC00
초성 인덱스 = (코드포인트 - 0xAC00) / 588
중성 인덱스 = ((코드포인트 - 0xAC00) % 588) / 28
종성 인덱스 = (코드포인트 - 0xAC00) % 28
```

그리고 합성 모음은 역으로 분해:  
`ㅔ(U+1154) → [ㅓ, ㅣ]`, `ㅐ(U+1162) → [ㅏ, ㅣ]` 등

---

## 입력 유효성 검사 — utils/gameLogic.ts

```typescript
export function isValidKeystroke(keys: string[]): boolean {
  if (keys.length !== 5) return false;

  // 5개 자모가 실제로 2음절 구조인지 검사
  return (
    (isValidSyllable(keys.slice(0, 2)) && isValidSyllable(keys.slice(2))) ||
    (isValidSyllable(keys.slice(0, 3)) && isValidSyllable(keys.slice(3)))
  );
  // keys.slice(0, 2) = 앞 2개 → Java의 Arrays.copyOfRange(keys, 0, 2)
}

// 하나의 음절 구조가 맞는지 확인
function isValidSyllable(keys: string[]): boolean {
  if (keys.length < 2 || keys.length > 3) return false;
  if (!CONSONANTS.has(keys[0])) return false;  // 첫 자가 자음이어야 함
  if (!VOWELS.has(keys[1])) return false;       // 둘째 자가 모음이어야 함
  if (keys.length === 2) return true;           // 자음+모음 = OK
  // 셋째 자가 자음(받침) 또는 합성 모음 재료이면 OK
  return CONSONANTS.has(keys[2]) || !!VOWEL_COMBO[keys[1]]?.[keys[2]];
}
```

> `?.` 연산자는 Java의 Optional과 비슷합니다.  
> `obj?.prop` = obj가 null이면 undefined 반환, 아니면 prop 접근

---

## 정답 판정 — evaluateGuess

워들의 핵심인 초록/노랑/회색 판정입니다.

```typescript
export function evaluateGuess(guess: string[], answer: string[]): TileStatus[] {
  const result: TileStatus[] = Array(5).fill('absent');  // 일단 전부 회색
  const answerCopy = [...answer];   // 원본 변경 방지
  const guessCopy  = [...guess];

  // 1차 패스: 정확히 일치하는 위치 먼저 처리 (초록)
  for (let i = 0; i < 5; i++) {
    if (guessCopy[i] === answerCopy[i]) {
      result[i] = 'correct';
      answerCopy[i] = '';   // 이미 매칭됐으니 제거
      guessCopy[i]  = '';
    }
  }

  // 2차 패스: 다른 위치에 있는 자모 찾기 (노랑)
  for (let i = 0; i < 5; i++) {
    if (guessCopy[i] === '') continue;  // 이미 초록으로 처리된 것 스킵

    const idx = answerCopy.indexOf(guessCopy[i]);
    if (idx !== -1) {
      result[i] = 'present';
      answerCopy[idx] = '';  // 같은 자모가 중복으로 노랑이 되지 않도록
    }
  }

  return result;
}
```

**왜 2패스인가?**  
"정확한 위치(초록)"를 먼저 소비해야, 중복 자모가 있을 때 잘못된 노랑을 표시하지 않습니다.

예: 정답 `ㅅㅏㅅ...`, 추측 `ㅅㅅ...`  
→ 첫 번째 ㅅ이 초록이 되면, 두 번째 ㅅ은 노랑이 되면 안 됨

---

## 상태 목록 — jamo-wordle이 관리하는 것들

다른 게임들보다 상태가 훨씬 많습니다:

```typescript
const [wordList, setWordList]       = useState<string[]>([]);       // 단어 목록
const [mode, setMode]               = useState<GameMode>('daily');  // 일일/자유 모드
const [targetWord, setTargetWord]   = useState<string>('');         // 오늘의 단어
const [answerJamo, setAnswerJamo]   = useState<string[]>([]);       // 자모 분해된 정답

const [guesses, setGuesses]         = useState<string[][]>([]);     // 이전 추측들
const [statuses, setStatuses]       = useState<TileStatus[][]>([]); // 각 추측의 색상 결과
const [currentGuess, setCurrentGuess] = useState<string[]>([]);    // 현재 입력 중인 것

const [keyStatuses, setKeyStatuses] = useState<Record<string, TileStatus>>({}); 
// 키보드의 각 자모 색상 (입력했던 자모들의 가장 좋은 결과)
```

`string[][]` = 2차원 배열. Java의 `List<List<String>>` 또는 `String[][]`와 같습니다.

---

## 키보드 색상 누적 — updateKeyStatuses

```typescript
const updateKeyStatuses = useCallback((guess: string[], result: TileStatus[]) => {
  setKeyStatuses(prev => {
    const next = { ...prev };   // 기존 상태 복사

    // 우선순위: correct(3) > present(2) > absent(1)
    const priority: Record<TileStatus, number> = {
      correct: 3, present: 2, absent: 1, empty: 0, active: 0
    };

    guess.forEach((jamo, i) => {
      const cur = next[jamo];   // 이 자모의 현재 색상
      // 더 좋은 색상이면 업데이트
      if (!cur || priority[result[i]] > priority[cur]) {
        next[jamo] = result[i];
      }
    });

    return next;
  });
}, []);
```

한번 초록으로 표시된 키는 다시 회색/노랑으로 내려가지 않습니다.

---

## 일일 모드 vs 자유 모드

```typescript
// 오늘 날짜 기반으로 단어를 결정 (같은 날엔 항상 같은 단어)
const today = getTodayWord(words);

// 자유 모드: 현재 단어를 제외하고 랜덤 선택
const startFreeMode = useCallback(() => {
  const newWord = getRandomWord(wordList, targetWord);  // targetWord를 제외
  setMode('free');
  setTargetWord(newWord);
  setAnswerJamo(decomposeToKeystrokes(newWord));
  // 게임 상태 초기화...
}, [wordList, targetWord]);
```

---

## 요약

| 개념 | 역할 |
|------|------|
| `decomposeToKeystrokes` | 한글 글자 → 자모 배열 변환 |
| `isValidKeystroke` | 5자모가 실제로 2음절인지 검증 |
| `evaluateGuess` (2패스) | 정확→포함→없음 순서로 판정해 중복 오류 방지 |
| `string[][]` | 이전 추측 목록 (2차원 배열) |
| `Record<string, TileStatus>` | 키보드 자모별 최선 색상 보관 |
| `?.` (optional chaining) | null 안전 접근 (Java Optional 비슷) |
