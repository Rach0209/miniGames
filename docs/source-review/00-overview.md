# 미니게임 소스 리뷰 — 개요

> **대상 독자**: Java / Vanilla JS는 알지만 TypeScript · React Native · Expo를 처음 접하는 분

---

## 이 프로젝트가 뭔가요?

**Expo + React Native (TypeScript)** 로 만든 미니게임 모음 앱입니다.  
코드 한 벌로 **iOS · Android · 웹** 세 플랫폼에서 동시에 돌아갑니다.

---

## 자주 나오는 개념 — Java/JS와 비교

### TypeScript = Java의 타입 선언 + JavaScript

```typescript
// Java라면
int score = 0;
String phase = "idle";

// TypeScript라면
const score: number = 0;
const phase: string = 'idle';

// 커스텀 타입 (Java의 enum 비슷)
type Phase = 'idle' | 'playing' | 'dead';
let phase: Phase = 'idle';    // 이 세 값만 허용

// 인터페이스 (Java의 interface/class 비슷)
interface Pipe {
  id: number;
  x: number;
  gapY: number;
  passed: boolean;
}
```

---

### React 컴포넌트 = 화면을 그리는 함수

```typescript
// Java였다면 class를 만들고 render() 메서드를 구현했겠지만
// React는 그냥 함수 하나가 컴포넌트입니다
export default function FlappyBirdScreen() {
  // 여기서 상태를 선언하고
  // JSX(HTML 같은 것)를 return 하면 화면이 됩니다
  return <View>...</View>;
}
```

---

### useState = 화면 갱신을 유발하는 변수

```typescript
// 일반 변수를 바꿔봐야 화면은 안 바뀜
let count = 0;
count = 1;  // ← 화면 변화 없음

// useState로 선언한 변수는 바꾸면 화면이 다시 그려짐
const [score, setScore] = useState(0);
setScore(1);   // ← 화면 자동 갱신
//  Java 느낌으로 표현하면:
//  private int score = 0;
//  public void setScore(int v) { this.score = v; this.repaint(); }
```

---

### useRef = 화면 갱신 없이 값만 보관하는 변수

```typescript
// Java의 private 필드처럼, 값을 저장하지만 화면 갱신은 안 함
const rafId = useRef<number | null>(null);
rafId.current = 42;    // .current 로 읽고 씁니다
```

> **게임 루프처럼 매 프레임 값이 바뀌는 것**은 setState를 쓰면 너무 자주 화면을 다시 그려서 느려집니다.  
> 그래서 게임 데이터는 `useRef`에 넣고, 화면 갱신은 필요할 때만 강제로 합니다.

---

### useEffect = 컴포넌트가 화면에 나타날 때/사라질 때 실행

```typescript
// Java의 @PostConstruct + @PreDestroy 같은 느낌
useEffect(() => {
  // 화면이 처음 나타날 때 실행
  loadBestScore();

  return () => {
    // 화면에서 사라질 때(unmount) 실행 — 정리 작업
    cancelAnimationFrame(rafId.current);
  };
}, []); // [] = 의존성 없음 = 최초 1회만 실행
```

---

### useCallback = 함수를 캐시하는 래퍼

```typescript
// 컴포넌트가 다시 그려질 때마다 함수가 새로 만들어지는 걸 방지
const handleTap = useCallback(() => {
  // 탭 처리 로직
}, [startGame, rerender]);   // 이 값이 바뀔 때만 함수를 새로 만듦
```

---

### StyleSheet = CSS를 JavaScript 객체로 쓰는 것

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,                    // 부모 공간 전부 차지 (CSS의 flex: 1)
    backgroundColor: '#121213',
    alignItems: 'center',       // CSS의 align-items: center
  },
  text: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

// 사용할 때
<View style={styles.container}>
  <Text style={styles.text}>Hello</Text>
</View>
```

---

## 파일 구조 한눈에 보기

```
app/
  index.tsx           ← 홈 화면 (게임 목록)
  flappy-bird/
    index.tsx         ← 플래피 버드 게임
  reaction-test/
    index.tsx         ← 반응속도 테스트
  color-memory/
    index.tsx         ← 색상 기억 게임
  pattern-memory/
    index.tsx         ← 패턴 기억 게임
  2048/
    index.tsx         ← 2048 퍼즐
  jamo-wordle/
    index.tsx         ← 자모 워들
  ascii-art/
    index.tsx         ← 텍스트 아트 변환기
utils/
  gameLogic.ts        ← 자모 워들 정답 판정 로직
  jamo.ts             ← 한글 자모 분해 유틸
  asciiArt.ts         ← 텍스트 아트 변환 함수들
  *Storage.ts         ← 각 게임별 점수 저장/불러오기
```

---

## 게임별 리뷰 파일 목록

| 파일 | 게임 | 핵심 주제 |
|------|------|-----------|
| [01-flappy-bird.md](./01-flappy-bird.md) | 플래피 버드 | 게임 루프, useRef vs useState |
| [02-reaction-test.md](./02-reaction-test.md) | 반응속도 테스트 | 상태 머신, setTimeout |
| [03-color-memory.md](./03-color-memory.md) | 색상 기억 | Animated API, setTimeout 체인 |
| [04-pattern-memory.md](./04-pattern-memory.md) | 패턴 기억 | Animated 보간, 반응형 레이아웃 |
| [05-2048.md](./05-2048.md) | 2048 | 이동 알고리즘, PanResponder(스와이프) |
| [06-jamo-wordle.md](./06-jamo-wordle.md) | 자모 워들 | 한글 자모 분해, 정답 판정 로직 |
| [07-ascii-art.md](./07-ascii-art.md) | 텍스트 아트 | useMemo, 순수 변환 함수 |
