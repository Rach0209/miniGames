# 색상 기억 게임 소스 리뷰

> **파일**: `app/color-memory/index.tsx`  
> **핵심 주제**: setTimeout 체인, Animated.sequence, 반응형 타일 크기

---

## 게임 개요

6개의 색상 타일이 순서대로 점등(깜빡임)됩니다. 점등이 끝난 뒤 플레이어가 같은 순서로 탭하면 다음 라운드로 넘어가고, 색이 하나 더 추가됩니다. 틀리면 게임 종료.

---

## 색상 데이터 구조

```typescript
const COLORS = [
  { id: 0, bg: '#E53935', label: '빨강' },
  { id: 1, bg: '#1E88E5', label: '파랑' },
  { id: 2, bg: '#43A047', label: '초록' },
  { id: 3, bg: '#FDD835', label: '노랑' },
  { id: 4, bg: '#8E24AA', label: '보라' },
  { id: 5, bg: '#FB8C00', label: '주황' },
];

// 시퀀스는 색상 id의 배열
// 예: [2, 0, 3] = 초록 → 빨강 → 노랑 순서
const [sequence, setSequence] = useState<number[]>([]);
```

---

## 타일 애니메이션 — Animated.sequence

각 타일마다 스케일(크기) 애니메이션 변수를 하나씩 갖습니다:

```typescript
// COLORS.length(6)개의 애니메이션 변수를 배열로 생성
const scaleAnims = useRef(COLORS.map(() => new Animated.Value(1)));
//  Java로 비유: private Animator[] scaleAnims = new Animator[6];

const flashColor = (colorId: number) => {
  scaleAnims.current[colorId].setValue(1);  // 초기화

  Animated.sequence([
    // 1단계: 1.0 → 1.15 크기 (200ms)
    Animated.timing(scaleAnims.current[colorId], {
      toValue: 1.15, duration: 200, useNativeDriver: true,
    }),
    // 2단계: 1.15 → 1.0 크기 (200ms)
    Animated.timing(scaleAnims.current[colorId], {
      toValue: 1, duration: 200, useNativeDriver: true,
    }),
  ]).start();  // 두 애니메이션을 순서대로 실행
};
```

---

## 시퀀스 표시 로직 — setTimeout 체인

시퀀스를 순서대로 보여주기 위해 `setTimeout`을 반복 등록합니다.

```typescript
const showSequence = useCallback((seq: number[]) => {
  setPhase('showing');

  // seq가 [2, 0, 3] 이라면:
  seq.forEach((colorId, i) => {
    // i=0: 400ms 후 초록 켜기
    // i=1: 1100ms(400+700) 후 파랑 켜기
    // i=2: 1800ms(400+1400) 후 노랑 켜기
    const t1 = setTimeout(() => {
      setActiveColor(colorId);   // 해당 색 강조 표시
      flashColor(colorId);       // 크기 애니메이션
    }, i * 700 + 400);

    const t2 = setTimeout(() => {
      setActiveColor(null);      // 강조 해제
    }, i * 700 + 900);

    timeouts.current.push(t1, t2);   // 나중에 취소하기 위해 저장
  });

  // 모든 표시가 끝난 뒤 입력 모드로 전환
  const endT = setTimeout(() => {
    setPhase('input');
  }, seq.length * 700 + 1000);
  timeouts.current.push(endT);
}, []);
```

> **왜 배열에 저장하나요?**  
> 게임 도중 홈으로 나가거나 다시 시작하면 `clearTimeouts()`로 모든 예약을 취소해야 하기 때문입니다.  
> 취소 안 하면 이미 종료된 게임의 타이머가 나중에 발동해서 버그가 생깁니다.

---

## 플레이어 입력 처리

```typescript
const handleColorPress = useCallback((colorId: number) => {
  if (phase !== 'input') return;   // 표시 중엔 입력 무시

  const idx = playerInput.length;  // 현재까지 입력한 개수 = 다음 확인할 인덱스

  if (colorId !== sequence[idx]) {
    // 틀림!
    setPhase('gameover');
    updateColorMemoryStats(score).then(setStats);  // 점수 저장
    return;
  }

  // 맞음
  const newInput = [...playerInput, colorId];

  if (newInput.length === sequence.length) {
    // 시퀀스 전부 맞힘 → 다음 라운드
    const newScore = score + 1;
    setScore(newScore);
    const nextColor = Math.floor(Math.random() * COLORS.length);
    const nextSeq = [...sequence, nextColor];   // 시퀀스에 하나 추가
    setSequence(nextSeq);
    setTimeout(() => showSequence(nextSeq), 800);  // 800ms 후 다음 시퀀스 표시
  } else {
    setPlayerInput(newInput);   // 아직 더 입력해야 함
  }
}, [phase, playerInput, sequence, score, showSequence]);
```

---

## 반응형 타일 크기

화면 너비에 따라 타일 크기를 자동 계산합니다:

```typescript
const { width: screenWidth } = useWindowDimensions();  // 현재 화면 너비

const availW = Math.min(screenWidth, 900) - 40;  // 최대 900px, 좌우 패딩 제외
const cols = availW / 3 >= 100 ? 3 : 2;           // 3칸 or 2칸 (좁은 화면)
const tileSize = Math.min(160, Math.floor((availW - 16 * (cols - 1)) / cols));
// 타일 크기 = 최대 160px, 남은 너비를 열 수로 나눔
```

작은 폰과 큰 태블릿 모두 자연스러운 크기로 표시됩니다.

---

## 렌더링 — Animated.View로 스케일 적용

```typescript
{COLORS.map((color) => (
  <Animated.View
    key={color.id}
    style={[
      { width: tileSize, height: tileSize },
      {
        transform: [{ scale: scaleAnims.current[color.id] }]
        // 애니메이션 변수가 바뀌면 크기가 자동으로 변함
      },
    ]}
  >
    <TouchableOpacity
      style={[
        { backgroundColor: color.bg },
        activeColor === color.id && styles.colorTileActive,  // 현재 점등 중이면 흰 테두리
        phase !== 'input' && styles.colorTileDisabled,        // 입력 단계 아니면 투명도 낮춤
      ]}
      onPress={() => handleColorPress(color.id)}
      disabled={phase !== 'input'}   // 입력 단계 아닐 때 탭 막기
    />
  </Animated.View>
))}
```

---

## 요약

| 개념 | 역할 |
|------|------|
| `setTimeout` 체인 | 색상을 순서대로 타이밍에 맞춰 점등 |
| `timeouts.current` 배열 | 타이머 취소를 위한 ID 보관 |
| `Animated.sequence` | 커졌다 줄어드는 탭 효과 |
| `useWindowDimensions` | 화면 너비에 맞게 타일 크기 계산 |
| `disabled` prop | 특정 단계에서 터치 입력 차단 |
