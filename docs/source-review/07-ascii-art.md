# 텍스트 아트 소스 리뷰

> **파일**: `app/ascii-art/index.tsx`, `utils/asciiArt.ts`  
> **핵심 주제**: useMemo, 순수 변환 함수, Platform 분기

---

## 게임 개요

텍스트를 입력하면 26가지 아트 스타일로 변환해서 보여줍니다.  
블록 글자, 이모지 테두리, 전각문자, 뒤집기, 모스 부호 등 다양합니다.

이 화면은 다른 게임들과 달리 **게임 로직이 없고, 순수 변환 함수들의 모음**입니다.

---

## 화면 구조 — 아주 단순함

```typescript
export default function AsciiArtScreen() {
  const [input, setInput] = useState('');   // 입력 텍스트

  // 입력값이 바뀔 때만 26가지 변환 결과를 다시 계산
  const results = useMemo(() => getArtResults(input), [input]);

  return (
    <ScrollView>
      <TextInput value={input} onChangeText={setInput} />
      {results.map(item => <ResultCard key={item.label} item={item} />)}
    </ScrollView>
  );
}
```

---

## useMemo — 불필요한 재계산 방지

```typescript
const results = useMemo(() => getArtResults(input), [input]);
```

`useMemo`는 **의존성 배열(`[input]`)이 변경될 때만 계산을 다시 실행**합니다.

예를 들어 탭으로 화면이 다시 그려질 때마다 26가지 변환을 다시 계산하면 낭비입니다.  
`input` 값이 실제로 바뀔 때만 계산하면 됩니다.

Java로 비유하면:
```java
// 매번 계산 (비효율)
String result = transform(input);  // render()가 불릴 때마다

// Lazy evaluation (효율적)
if (inputChanged) {
    result = transform(input);
    inputChanged = false;
}
```

---

## 변환 함수 구조 — utils/asciiArt.ts

```typescript
export interface ArtResult {
  label: string;    // 변환 이름 (예: "블록 글자", "전각문자")
  value: string;    // 변환 결과 문자열
  mono?: boolean;   // true면 모노스페이스 폰트로 표시
  scrollX?: boolean; // true면 가로 스크롤 허용 (블록 글자 같이 길 때)
}

export function getArtResults(input: string): ArtResult[] {
  if (!input) return [];   // 빈 입력이면 빈 배열

  return [
    { label: '블록 글자', value: toBlockLetters(input), mono: true, scrollX: true },
    { label: '전각문자', value: toFullwidth(input) },
    { label: '뒤집기', value: toUpsideDown(input) },
    { label: '모스 부호', value: toMorse(input), mono: true },
    // ... 26가지
  ];
}
```

---

## 변환 예시 — 전각문자

```typescript
function toFullwidth(text: string): string {
  return [...text]   // 문자열을 문자 배열로 (Java의 toCharArray())
    .map(ch => {
      const code = ch.charCodeAt(0);
      // 알파벳·숫자·기호는 전각 유니코드로 변환
      // A(65) → Ａ(65297), a(97) → ａ(65345)
      if (code >= 33 && code <= 126) {
        return String.fromCharCode(code + 0xFEE0);
      }
      return ch;  // 한글·특수문자는 그대로
    })
    .join('');
}
```

> `[...text]`는 문자열을 배열로 펼치는 스프레드 연산자입니다.  
> Java의 `text.chars().mapToObj(c -> ...)` 과 유사합니다.  
> 단순히 `text.split('')`과 다른 점은 이모지(4바이트 문자)도 올바르게 처리합니다.

---

## 변환 예시 — 블록 글자

알파벳을 5×5 픽셀 폰트로 표현합니다:

```typescript
// 각 알파벳을 5행짜리 픽셀 패턴으로 정의
const BLOCK_FONT: Record<string, string[]> = {
  'A': [
    ' ▓▓▓ ',
    '▓   ▓',
    '▓▓▓▓▓',
    '▓   ▓',
    '▓   ▓',
  ],
  'B': [
    '▓▓▓▓ ',
    '▓   ▓',
    '▓▓▓▓ ',
    '▓   ▓',
    '▓▓▓▓ ',
  ],
  // ...
};

function toBlockLetters(text: string): string {
  const chars = text.toUpperCase().split('');

  // 5행을 동시에 구성
  const rows = Array(5).fill('');
  for (const ch of chars) {
    const pattern = BLOCK_FONT[ch] || BLOCK_FONT[' '];
    for (let r = 0; r < 5; r++) {
      rows[r] += pattern[r] + '  ';   // 글자 사이 간격
    }
  }

  return rows.join('\n');   // 5행을 줄바꿈으로 이어붙임
}
```

---

## 복사 기능 — Platform 분기

```typescript
function copyText(text: string, onDone: () => void) {
  if (Platform.OS === 'web') {
    // 웹 환경: 브라우저 Clipboard API 사용
    navigator.clipboard.writeText(text).then(onDone);
  }
  // iOS/Android: expo-clipboard 같은 네이티브 모듈 필요
  // (현재는 웹 전용으로만 구현)
}
```

`Platform.OS`는 현재 실행 환경을 확인합니다:
- `'web'` — 브라우저
- `'ios'` — iPhone/iPad
- `'android'` — 안드로이드

Java의 `System.getProperty("os.name")` 비슷한 개념입니다.

---

## ResultCard 컴포넌트 — 지역 상태

```typescript
function ResultCard({ item }: { item: ArtResult }) {
  const [copied, setCopied] = useState(false);  // 이 카드만의 로컬 상태

  const handleCopy = () => {
    copyText(item.value, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);  // 1.5초 후 원래대로
    });
  };

  return (
    <View>
      <Text>{item.label}</Text>
      <TouchableOpacity onPress={handleCopy}>
        <Text>{copied ? '✅ 복사됨' : '복사'}</Text>
      </TouchableOpacity>
      <Text selectable>{item.value}</Text>  {/* selectable = 텍스트 선택 가능 */}
    </View>
  );
}
```

각 카드가 독립적인 `copied` 상태를 가집니다.  
A카드를 복사해도 B카드는 영향받지 않습니다.

---

## 요약

| 개념 | 역할 |
|------|------|
| `useMemo(() => fn(), [dep])` | 의존성이 바뀔 때만 재계산 (성능 최적화) |
| `[...text]` | 문자열 → 문자 배열 (이모지 안전) |
| `String.fromCharCode(code + 0xFEE0)` | 반각 → 전각 유니코드 변환 |
| `Platform.OS` | 웹/iOS/Android 환경 분기 |
| `selectable` prop | 텍스트를 손가락으로 선택/복사 허용 |
| 컴포넌트별 `useState` | 각 카드가 독립적인 상태 보유 |
