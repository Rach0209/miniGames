# Expo & 프로젝트 아키텍처 설명

> **대상 독자**: Java 백엔드 개발자 — Expo / React Native를 처음 접하는 분

---

## 1. Expo가 뭔가요?

한 줄 요약: **React Native 앱을 쉽게 개발·빌드·배포할 수 있게 해주는 플랫폼 + 툴킷**입니다.

React Native만 쓰면 iOS/Android 빌드 환경(Xcode, Android Studio, NDK 등)을 직접 세팅해야 합니다.  
Expo가 그 복잡한 네이티브 레이어를 대신 관리해줘서, **코드만 짜면 알아서 빌드**해줍니다.

```
Java 세계로 비유하면:
  React Native  =  JVM (실행 엔진)
  Expo          =  Spring Boot (세팅을 대신 해주는 프레임워크)
```

---

## 2. 개발할 때 서버가 어떻게 돌아가나요?

`npx expo start`를 치면 두 개의 서버가 뜹니다.

```
┌─────────────────────────────────────────────────────┐
│  개발 PC                                             │
│                                                      │
│  ① Metro 번들러 (포트 8081)                          │
│     - TypeScript/JSX → JS 변환 (Babel)               │
│     - 코드 변경 감지 → 폰에 즉시 반영 (HMR)          │
│                                                      │
│  ② Expo Dev Server (포트 8082)                       │
│     - QR 코드 생성                                    │
│     - 폰과 WebSocket 연결 유지                        │
└──────────────────┬──────────────────────────────────┘
                   │  Wi-Fi (같은 네트워크)
                   ▼
┌─────────────────────────────────────────────────────┐
│  iPhone / Android                                    │
│                                                      │
│  Expo Go 앱                                          │
│  - QR 스캔 → Dev Server에 연결                       │
│  - Metro에서 JS 번들 다운로드                         │
│  - 네이티브 UI(카메라, 터치 등)는 Expo Go가 제공     │
└─────────────────────────────────────────────────────┘
```

**HMR (Hot Module Replacement)**: 코드를 저장하면 앱을 껐다 켤 필요 없이 변경 부분만 폰에 즉시 반영됩니다. Spring DevTools의 자동 재시작과 비슷하지만 훨씬 빠릅니다.

---

## 3. 빌드 파이프라인 — 코드가 폰에서 실행되기까지

```
TypeScript (.tsx)
      │
      ▼  Babel (babel-preset-expo)
JavaScript (.js)  ← 트랜스파일, JSX → React.createElement() 변환
      │
      ▼  Metro 번들러
단일 JS 번들 (index.bundle)
      │
      ├── 개발 모드: 폰이 Metro에서 실시간으로 받아 실행
      │
      └── 프로덕션 빌드: EAS Build (Expo 클라우드)
              │
              ├── iOS  → .ipa (App Store)
              └── Android → .apk / .aab (Play Store)
```

**왜 JS가 앱으로 동작하나요?**  
React Native의 핵심은 "JS 코드 → 네이티브 UI 명령어 변환" 브릿지입니다.  
`<View>`, `<Text>` 같은 컴포넌트가 각각 iOS의 `UIView`, Android의 `android.view.View`로 변환됩니다.  
웹뷰가 아니라 **진짜 네이티브 UI**로 그려집니다.

---

## 4. 이 프로젝트의 아키텍처 선택 이유

### 4-1. Expo Router — 파일 기반 라우팅

```
app/
  index.tsx          → "/" 경로 (홈 화면)
  flappy-bird/
    index.tsx        → "/flappy-bird" 경로
  2048/
    index.tsx        → "/2048" 경로
  _layout.tsx        → 모든 화면을 감싸는 공통 레이아웃
```

**Next.js의 App Router와 완전히 같은 방식입니다.**  
파일을 만들면 자동으로 라우트가 생깁니다. 별도로 라우터 등록 코드를 쓸 필요가 없습니다.

```typescript
// 게임 화면으로 이동 — Spring MVC의 redirect와 비슷한 느낌
import { useRouter } from 'expo-router';
const router = useRouter();
router.push('/flappy-bird');
```

**선택 이유**: 게임이 늘어날수록 폴더만 추가하면 라우트가 자동 등록되어 확장이 쉽습니다.

---

### 4-2. `_layout.tsx` — 공통 헤더/컨테이너

```typescript
// app/_layout.tsx
export default function RootLayout() {
  return (
    <SafeAreaProvider>        {/* 노치/홈바 안전 영역 자동 계산 */}
      <Stack                  {/* iOS 스타일 스택 네비게이션 */}
        screenOptions={{
          headerStyle: { backgroundColor: '#121213' },
          headerTintColor: '#fff',
        }}
      />
    </SafeAreaProvider>
  );
}
```

Spring의 `@ControllerAdvice` + 공통 레이아웃 템플릿(Thymeleaf layout dialect)과 비슷합니다.  
모든 화면에서 공통으로 적용할 헤더 스타일, 배경색, 뒤로가기 버튼 색상을 여기서 한 번만 설정합니다.

---

### 4-3. AsyncStorage — 로컬 데이터 저장

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// 저장 (비동기 — Java의 CompletableFuture 느낌)
await AsyncStorage.setItem('flappy_best_score_v1', String(score));

// 불러오기
const saved = await AsyncStorage.getItem('flappy_best_score_v1');
```

**브라우저의 localStorage와 동일한 역할**입니다. 앱을 꺼도 유지되는 기기 로컬 저장소입니다.  
현재는 각 게임의 최고 점수를 여기에 저장합니다.

---

### 4-4. Phase 1 오프라인 구조 선택 이유

현재 아키텍처는 **서버 없이 완전 로컬**로 동작합니다.

```
사용자 기기
  └── Expo Go / 네이티브 앱
        ├── 게임 로직 (JS, 기기에서 실행)
        ├── 점수 저장 (AsyncStorage — 기기 내부)
        └── 네트워크 없음
```

**이렇게 선택한 이유**:
- 게임 자체는 네트워크가 필요 없음 — 불필요한 의존성 제거
- 오프라인에서도 완전히 동작
- Phase 2에서 Spring Boot 서버를 붙일 때 (랭킹, 멀티플레이 등) AsyncStorage → API 호출로 교체 예정

---

## 5. 핵심 패키지 한눈에 보기

| 패키지 | 역할 | Java 비유 |
|--------|------|-----------|
| `expo` | 플랫폼 코어, 빌드 툴 | Spring Boot |
| `expo-router` | 파일 기반 라우팅 | Spring MVC (URL 매핑) |
| `react-native` | 네이티브 UI 컴포넌트 | AWT/Swing (UI 렌더링) |
| `react-native-web` | 같은 코드를 웹 브라우저에서도 실행 | - |
| `@expo/vector-icons` | 아이콘 라이브러리 (Ionicons 등) | Font Awesome |
| `@react-native-async-storage/async-storage` | 로컬 key-value 저장소 | localStorage / Properties 파일 |
| `react-native-safe-area-context` | 노치/홈바 영역 계산 | - |
| `react-native-svg` | SVG 그래픽 렌더링 | - |
| `@supabase/supabase-js` | BaaS (DB, Auth) 클라이언트 — Phase 2 준비 | JDBC / JPA |
| `babel-preset-expo` | TypeScript/JSX 트랜스파일 설정 | Maven compiler plugin |

---

## 6. `expo start` 명령어 옵션

```bash
npx expo start           # 기본 — 같은 Wi-Fi에서 QR 스캔
npx expo start --tunnel  # ngrok 터널 — 다른 네트워크에서도 접속 가능
npx expo start --android # 안드로이드 에뮬레이터 자동 실행
npx expo start --ios     # iOS 시뮬레이터 자동 실행 (Mac 전용)
npx expo start --web     # 브라우저에서 실행
```

---

## 7. 전체 아키텍처 흐름 요약

```
[개발자]
  코드 작성 (TypeScript + JSX)
      │
      ▼
[Metro 번들러] — babel-preset-expo로 트랜스파일
      │
      ├── 개발: Wi-Fi로 Expo Go에 스트리밍
      │         코드 저장 → HMR → 즉시 반영
      │
      └── 배포: EAS Build → App Store / Play Store

[런타임 — 기기]
  JS 번들 실행
    └── React Native 브릿지
          ├── iOS: UIKit 네이티브 뷰
          └── Android: Android View 시스템
```

---

> **다음 단계 (Phase 2)**: Spring Boot 서버를 붙여 글로벌 랭킹, 소셜 로그인 등을 추가할 예정.  
> Supabase 패키지(`@supabase/supabase-js`)가 이미 설치된 이유도 Phase 2 준비 때문입니다.
