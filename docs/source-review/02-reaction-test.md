# 반응속도 테스트 소스 리뷰

> **파일**: `app/reaction-test/index.tsx`  
> **핵심 주제**: 상태 머신(State Machine), setTimeout, Animated API 기초

---

## 게임 개요

빨간 화면이 초록색으로 바뀌는 순간 탭하면 반응 시간(ms)을 측정합니다.  
5번 측정 후 평균을 계산하고, 최고 기록을 갱신하면 랭킹에 저장됩니다.

---

## 상태 머신(State Machine)

이 게임의 핵심은 **게임이 현재 어떤 단계에 있는지** 추적하는 것입니다.

```typescript
type Phase = 'idle' | 'waiting' | 'go' | 'early' | 'result' | 'done';
//            대기     빨간화면   초록화면  너무일찍  결과표시   완료
```

Java로 표현하면:
```java
enum Phase { IDLE, WAITING, GO, EARLY, RESULT, DONE }
```

각 단계에서 탭하면 다음 단계로 전환됩니다:

```
[idle]
  ↓ 탭 → startRound()
[waiting] ← 빨간 화면, 랜덤 딜레이 후 자동으로 GO로
  ↓ 너무 일찍 탭
[early] ← "너무 일찍!" 메시지
  ↓ 탭 → startRound() 재시도

[waiting]
  ↓ 타이머 만료 (1~4초 후 자동)
[go] ← 초록 화면! 지금 탭해야 함
  ↓ 탭
[result] ← ms 표시
  ↓ 탭 → startRound() (5번 채울 때까지)
  
[done] ← 5번 완료, 평균 표시
```

---

## 핵심 로직 — startRound와 handleTap

```typescript
const startRound = useCallback(() => {
  setPhase('waiting');

  // 1~4초 랜덤 딜레이 후 초록으로 전환
  const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  //           1000ms       + 0~3000ms

  timeoutRef.current = setTimeout(goToGreen, delay);
  // Java로 치면: Timer timer = new Timer();
  //             timer.schedule(new GoToGreenTask(), delay);
}, [goToGreen, bgAnim]);

const handleTap = useCallback(() => {
  if (phase === 'idle' || phase === 'done') return;  // 이 단계에선 탭 무시

  if (phase === 'waiting') {
    clearTimeout(timeoutRef.current);  // 예약된 타이머 취소!
    setPhase('early');                 // 너무 일찍 탭
    return;
  }

  if (phase === 'go') {
    const ms = Date.now() - startTime.current;  // 경과 시간 측정
    setLastMs(ms);
    // ...다음 라운드 or 완료 처리
  }
}, [phase, results, startRound]);
```

> **핵심**: `setTimeout`으로 예약한 타이머가 있을 때 사용자가 먼저 탭하면 `clearTimeout`으로 취소해야 합니다.  
> Java의 `ScheduledFuture.cancel()` 과 같은 개념입니다.

---

## 배경색 애니메이션 — Animated API

```typescript
// 0~1 사이 값을 가지는 애니메이션 변수
const bgAnim = useRef(new Animated.Value(0)).current;

// 이 값을 실제 색깔로 변환
const bgColor = bgAnim.interpolate({
  inputRange:  [0, 1],
  outputRange: ['#8B0000', '#1B5E20'],
  //            빨강        초록
});
```

`interpolate`는 0→1 사이 숫자를 색깔로 매핑합니다.  
Java로 비유하면 `lerp(startColor, endColor, t)` 같은 함수입니다.

```typescript
// 빨간색으로 전환 (80ms 동안)
Animated.timing(bgAnim, {
  toValue: 0,          // 목표값
  duration: 80,        // 걸리는 시간(ms)
  useNativeDriver: false,  // 색상은 JS 쪽에서 처리
}).start();

// 초록색으로 전환
Animated.timing(bgAnim, { toValue: 1, duration: 80, useNativeDriver: false }).start();
```

---

## 반응속도 측정 원리

```typescript
const startTime = useRef(0);   // 초록 화면이 된 시각

const goToGreen = useCallback(() => {
  setPhase('go');
  startTime.current = Date.now();   // 시작 시각 기록
}, []);

// 탭했을 때
if (phase === 'go') {
  const ms = Date.now() - startTime.current;   // 경과 시간 = 반응속도
  setLastMs(ms);
}
```

`Date.now()`는 1970년 1월 1일 이후 경과한 밀리초를 반환합니다.  
두 시점의 차이가 곧 반응 시간입니다. (vanilla JS에서도 동일하게 사용)

---

## 점수 저장 구조 — Supabase

```typescript
// utils/reactionStorage.ts 의 핵심
export async function updateReactionStats(avgMs: number): Promise<ReactionStats> {
  const stats = await loadReactionStats();
  stats.totalGames += 1;
  if (stats.bestMs === 0 || avgMs < stats.bestMs) stats.bestMs = avgMs;
  // bestMs가 낮을수록 좋음 (반응이 빠를수록 좋은 점수)

  const user = await getCurrentUser();
  if (user) {
    // 로그인 상태면 Supabase(클라우드 DB)에 저장
    await saveRemoteStats(user.id, stats, avgMs, username);
  }
  return stats;
}
```

로그인 없으면 저장 건너뜀 → 로그인하면 자동으로 클라우드에 저장됩니다.

---

## 요약

| 개념 | 역할 |
|------|------|
| `type Phase` | 게임 단계를 타입으로 제한 (엉뚱한 값 방지) |
| `setTimeout` / `clearTimeout` | 랜덤 딜레이 구현 + 취소 |
| `useRef(0)` (startTime) | 화면 갱신 없이 시작 시각만 저장 |
| `Animated.Value` + `interpolate` | 숫자값을 색깔로 부드럽게 변환 |
| `Date.now()` | 밀리초 단위 시간 측정 |
