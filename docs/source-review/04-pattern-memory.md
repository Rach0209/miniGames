# 패턴 기억 게임 소스 리뷰

> **파일**: `app/pattern-memory/index.tsx`  
> **핵심 주제**: Animated.Value 색상 보간, 동적 그리드 레이아웃, 증가하는 속도 설계

---

## 게임 개요

N×N 그리드(4×4 ~ 10×10 선택 가능)에서 셀들이 순서대로 깜빡입니다.  
같은 순서로 탭하면 다음 라운드로 넘어가고 시퀀스가 하나 더 늘어납니다.  
색상 기억 게임과 구조는 비슷하지만, **셀 개수가 최대 100개**이고 **라운드마다 속도가 빨라집니다.**

---

## 그리드 크기 선택

```typescript
const GRID_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];

const [gridSize, setGridSize] = useState(4);  // 기본값 4×4
```

`gridSize`가 4라면 셀은 `4 × 4 = 16`개입니다.  
각 셀은 0~15 인덱스로 식별됩니다.

---

## 셀별 애니메이션 변수

```typescript
const cellAnims = useRef<Animated.Value[]>([]);

// gridSize가 바뀔 때마다 애니메이션 배열 재생성
const initAnims = useCallback((size: number) => {
  cellAnims.current = Array(size * size)
    .fill(null)
    .map(() => new Animated.Value(0));
  // size=4 → 16개의 Animated.Value(0) 생성
}, []);
```

---

## 색상 보간 (Interpolate) — 3가지 색 전환

색상 기억 게임은 단순히 `activeColor`를 setState로 바꿨지만,  
패턴 기억 게임은 **Animated 값(0→1→2)을 색깔에 매핑**해서 더 부드럽게 처리합니다.

```typescript
const flashCell = useCallback((idx: number, color: 'on' | 'err' = 'on') => {
  const anim = cellAnims.current[idx];
  anim.setValue(0);

  Animated.sequence([
    Animated.timing(anim, {
      toValue: color === 'on' ? 1 : 2,   // 정답이면 1, 오답이면 2
      duration: 150,
      useNativeDriver: false,             // 색상은 JS 쪽에서만 처리 가능
    }),
    Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: false }),
  ]).start();
}, []);
```

렌더링할 때 이 숫자를 색깔로 변환:

```typescript
const bgColor = anim.interpolate({
  inputRange:  [0,          1,          2         ],
  outputRange: ['#3A3A3C', '#FFD700', '#FF3B30'],
  //            꺼짐(회색)   정답(금색)   오답(빨강)
});

<Animated.View style={{ backgroundColor: bgColor }} />
// 숫자가 바뀌면 색이 자동으로 전환됨
```

`interpolate`는 어떤 숫자 범위를 다른 값(색, 크기, 위치 등) 범위로 매핑하는 함수입니다.

---

## 속도 증가 로직

라운드가 올라갈수록 표시 간격이 짧아집니다:

```typescript
const showSequence = useCallback((seq: number[], size: number) => {
  const round = seq.length;  // 현재 시퀀스 길이 = 라운드 번호

  // 1라운드: 700ms 간격
  // 라운드마다 20ms씩 감소
  // 최소 300ms 이하로는 내려가지 않음
  const interval = Math.max(300, 700 - (round - 1) * 20);

  seq.forEach((cellIdx, i) => {
    setTimeout(() => flashCell(cellIdx, 'on'), i * interval + 400);
  });
}, [flashCell]);
```

| 라운드 | 간격 |
|--------|------|
| 1 | 700ms |
| 10 | 520ms |
| 20 | 320ms |
| 21+ | 300ms (최소값) |

---

## 오답 처리 — 딜레이 후 게임오버

```typescript
if (cellIdx !== sequence[idx]) {
  setErrorCell(cellIdx);
  flashCell(cellIdx, 'err');  // 빨간색으로 번쩍임

  const t = setTimeout(() => {
    setErrorCell(null);
    setPhase('gameover');          // 600ms 후 게임오버 화면
    updatePatternMemoryStats(score).then(setStats);
  }, 600);
  timeouts.current.push(t);
  return;
}
```

즉시 게임오버로 전환하지 않고 600ms 딜레이를 주어, 빨간색 번쩍임을 플레이어가 볼 수 있게 합니다.

---

## 그리드 렌더링 — 절대 위치로 배치

N×N 그리드를 `position: absolute`로 배치합니다:

```typescript
const cellSize = (BOARD_SIZE - GAP * (gridSize + 1)) / gridSize;
// 보드 크기에서 간격(GAP)을 빼고 셀 수로 나눔

{Array(gridSize * gridSize).fill(null).map((_, cellIdx) => {
  const row = Math.floor(cellIdx / gridSize);  // 셀 번호 → 행 계산
  const col = cellIdx % gridSize;               // 셀 번호 → 열 계산
  const x = GAP + col * (cellSize + GAP);
  const y = GAP + row * (cellSize + GAP);

  return (
    <Animated.View
      key={cellIdx}
      style={{
        position: 'absolute',
        width: cellSize, height: cellSize,
        left: x, top: y,
        backgroundColor: bgColor,  // interpolate된 색상
      }}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}  // 터치 영역을 셀 전체로
        onPress={() => handleCellPress(cellIdx)}
        disabled={phase !== 'input'}
      />
    </Animated.View>
  );
})}
```

셀 인덱스 0~15(4×4 기준)를 행/열로 변환하는 공식:
- 행 = `Math.floor(idx / gridSize)`
- 열 = `idx % gridSize`

---

## 언마운트 시 정리

```typescript
useEffect(() => () => clearTimeouts(), [clearTimeouts]);
// 컴포넌트가 화면에서 사라질 때 모든 타이머 취소
```

`useEffect`의 반환값이 함수이면, 그 함수가 언마운트 시 실행됩니다.  
`() => clearTimeouts()` = 타이머를 모두 취소하는 정리 함수.

---

## 요약

| 개념 | 역할 |
|------|------|
| `Animated.Value(0)` + `interpolate` | 숫자 0/1/2를 회색/금색/빨강으로 변환 |
| `useNativeDriver: false` | 색상 애니메이션은 JS 쪽에서 처리 필요 |
| `Math.max(300, 700 - round * 20)` | 라운드마다 빨라지되 최소 속도 보장 |
| `Math.floor(idx / size)` / `idx % size` | 1D 인덱스 → 2D 행/열 변환 |
| `useEffect(() => () => cleanup(), [])` | 언마운트 시 타이머 정리 |
