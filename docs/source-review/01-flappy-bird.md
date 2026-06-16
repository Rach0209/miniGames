# 플래피 버드 소스 리뷰

> **파일**: `app/flappy-bird/index.tsx`  
> **핵심 주제**: 게임 루프, useRef vs useState 선택 기준

---

## 게임 개요

화면을 탭할 때마다 새가 위로 튀어 오르고, 중력에 의해 아래로 떨어지면서 파이프 사이를 통과하는 게임입니다.  
매 프레임(약 1/60초) 마다 물리 계산이 일어나야 하기 때문에 **게임 루프**가 핵심입니다.

---

## 상수 선언부 — 게임 물리 튜닝 값

```typescript
const GRAVITY = 0.25;        // 매 프레임 속도에 더해지는 중력 가속도
const JUMP_VEL = -7.0;       // 탭할 때 주는 위쪽 속도 (음수 = 위로)
const PIPE_SPEED = 2.6;      // 파이프가 매 프레임 왼쪽으로 이동하는 픽셀
const PIPE_GAP = 185;        // 위/아래 파이프 사이 통로 높이(픽셀)
const PIPE_SPAWN_FRAMES = 210; // 몇 프레임마다 파이프를 하나 생성할지
```

이 값들만 조정해서 게임 난이도를 바꿀 수 있습니다.

---

## 타입 선언

```typescript
type Phase = 'idle' | 'playing' | 'dead';
// Java enum으로 비유하면: enum Phase { IDLE, PLAYING, DEAD }

interface Pipe {
  id: number;    // 각 파이프를 구별하는 고유 번호 (렌더링 key용)
  x: number;     // 파이프의 현재 X 좌표
  gapY: number;  // 파이프 통로의 중심 Y 좌표
  passed: boolean; // 이 파이프를 통과해서 점수를 줬는지 여부
}
```

---

## 핵심 설계 — useRef vs useState 선택 기준

게임 루프는 1초에 60번 실행됩니다. 매번 `setState`로 화면을 갱신하면 React가 1초에 60번씩 전체 화면을 다시 계산해야 해서 **느립니다**.

그래서 이 게임은 두 가지를 분리했습니다:

```typescript
// 게임 데이터 — useRef에 저장 (화면 갱신 없음, 빠름)
const G = useRef({
  phase: 'idle' as Phase,
  birdY: 200,       // 새의 Y 좌표
  birdVel: 0,       // 새의 현재 속도
  birdRot: 0,       // 새의 기울기 각도
  pipes: [] as Pipe[],
  score: 0,
  bestScore: 0,
  frame: 0,         // 몇 번째 프레임인지 카운터
  nextId: 0,        // 다음 파이프 ID
});

// 화면 갱신 트리거 — useState (최소한만 사용)
const [, forceRender] = useState(0);
const rerender = useCallback(() => forceRender(n => n + 1), []);
// useState의 값 자체는 쓰지 않고, set 함수만 호출해서 화면 갱신을 강제함
```

> Java로 비유하면:  
> `G`는 `private GameState state = new GameState()` 같은 필드,  
> `rerender()`는 `canvas.repaint()` 같은 메서드입니다.

---

## 게임 루프 — `loop` 함수

```typescript
const loop = useCallback(() => {
  const g = G.current;   // G.current로 최신 게임 상태 접근

  if (g.phase !== 'playing') return;  // 게임 중이 아니면 중단

  // 1. 물리 계산
  // 매 프레임마다 중력을 속도에 더하고, 속도를 위치에 더함
  // Math.min(... , 6) 으로 최대 낙하 속도를 6px/frame으로 제한
  g.birdVel = Math.min(g.birdVel + GRAVITY, 6);
  g.birdY += g.birdVel;

  // 2. 파이프 생성 (210 프레임마다)
  g.frame++;
  if (g.frame % PIPE_SPAWN_FRAMES === 0) {
    const margin = 110;
    const gapY = margin + Math.random() * (playH - margin * 2);
    g.pipes.push({ id: g.nextId++, x: W + 10, gapY, passed: false });
    // 새 파이프는 화면 오른쪽 바깥에서 시작
  }

  // 3. 파이프 이동 + 점수 체크
  for (let i = g.pipes.length - 1; i >= 0; i--) {
    g.pipes[i].x -= PIPE_SPEED;  // 왼쪽으로 이동

    // 화면 밖으로 나간 파이프는 배열에서 제거 (메모리 관리)
    if (g.pipes[i].x < -(PIPE_WIDTH + 20)) {
      g.pipes.splice(i, 1);
      continue;
    }

    // 새가 파이프를 통과했을 때 점수 +1
    if (!g.pipes[i].passed && g.pipes[i].x + PIPE_WIDTH < BIRD_X) {
      g.pipes[i].passed = true;
      g.score++;
    }
  }

  // 4. 충돌 판정
  // ...

  // 5. 화면 갱신 후 다음 프레임 예약
  rerender();
  rafId.current = requestAnimationFrame(loop);
  //  requestAnimationFrame = 브라우저/앱에게
  //  "다음 화면 갱신 타이밍에 이 함수를 다시 실행해줘" 라고 요청
}, [rerender]);
```

---

## 충돌 판정 — 히트박스 축소 트릭

```typescript
const HITBOX_SHRINK = 7;  // 시각적 크기보다 히트박스를 이 만큼 줄임

const bL = BIRD_X + HITBOX_SHRINK;       // 새의 왼쪽 경계 (안쪽)
const bR = BIRD_X + BIRD_SIZE - HITBOX_SHRINK; // 새의 오른쪽 경계 (안쪽)
const bT = g.birdY + HITBOX_SHRINK;
const bB = g.birdY + BIRD_SIZE - HITBOX_SHRINK;

for (const p of g.pipes) {
  // 가로로 겹치지 않으면 이 파이프는 스킵
  if (bR <= p.x || bL >= p.x + PIPE_WIDTH) continue;

  // 통로 범위
  const gTop = p.gapY - PIPE_GAP / 2;
  const gBot = p.gapY + PIPE_GAP / 2;

  // 새가 통로 밖에 있으면 충돌
  if (bT < gTop || bB > gBot) { hitPipe = true; break; }
}
```

이모지 크기보다 히트박스를 약간 작게 설정해서, 아슬아슬하게 통과하는 쾌감을 줍니다.

---

## 화면 크기 측정 — onLayout

```typescript
const handleLayout = useCallback((e: LayoutChangeEvent) => {
  const { width, height } = e.nativeEvent.layout;
  dims.current = { W: width, H: height };  // 실제 화면 크기를 ref에 저장
}, [rerender]);

// JSX에서
<TouchableOpacity onLayout={handleLayout} ...>
```

화면 크기를 하드코딩하면 기기마다 달라지기 때문에, 실제 레이아웃이 완료된 뒤에 크기를 측정합니다.  
이 정보로 파이프의 높이, 새의 초기 위치 등을 계산합니다.

---

## 렌더링 — 모든 요소를 절대 위치(absolute)로 배치

```typescript
// 파이프 (위쪽)
<View style={[styles.pipe, {
  left: pipe.x,   // 계산된 X 좌표
  top: 0,
  width: PIPE_WIDTH,
  height: topH,   // gapY - PIPE_GAP/2 로 계산한 높이
}]} />

// 새
<View style={[styles.bird, {
  left: BIRD_X,         // X는 고정
  top: g.birdY,         // Y만 매 프레임 변함
  transform: [{ rotate: `${g.birdRot}deg` }],  // 속도에 따라 기울어짐
}]}>
  <Text>🐥</Text>
</View>
```

게임 화면은 CSS의 `position: absolute`처럼 각 요소의 정확한 좌표를 직접 지정합니다.  
React Native의 기본 레이아웃(Flexbox)이 아니라, 게임용 좌표계를 직접 구현하는 방식입니다.

---

## 최고 점수 저장 — AsyncStorage

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// 저장 (비동기, await 없이 그냥 호출해도 됨)
AsyncStorage.setItem('flappy_best_score_v1', String(g.score));

// 불러오기
AsyncStorage.getItem('flappy_best_score_v1').then(v => {
  if (v) G.current.bestScore = parseInt(v, 10);
});
```

`AsyncStorage`는 기기의 로컬 저장소입니다. Java의 `SharedPreferences`나 브라우저의 `localStorage`와 같은 개념입니다.

---

## 요약

| 개념 | 이 게임에서의 역할 |
|------|-------------------|
| `useRef` | 매 프레임 바뀌는 게임 상태 보관 (새 위치, 파이프 배열 등) |
| `requestAnimationFrame` | 60fps 게임 루프 구현 |
| `useState(0)` (forceRender) | 프레임마다 화면 갱신 강제 |
| `onLayout` | 실제 기기의 화면 크기 측정 |
| `position: absolute` | 게임 요소를 좌표 기반으로 배치 |
| `AsyncStorage` | 최고 점수 영구 저장 |
