# miniGames — Claude 작업 가이드

## 프로젝트 개요
한국어 자모 기반 미니게임 모음 앱.
Expo React Native (TypeScript) — 웹/iOS/Android 동시 지원.

- **GitHub**: https://github.com/Rach0209/miniGames
- **배포 URL**: https://Rach0209.github.io/miniGames
- **로컬 실행**: `npx expo start --web --port 8083`

---

## 기술 스택
| 영역 | 기술 |
|------|------|
| 프레임워크 | Expo ~56, React Native 0.85, TypeScript |
| 라우팅 | expo-router (파일 기반) |
| 로컬 저장 | @react-native-async-storage/async-storage |
| 배포 | GitHub Pages (npx expo export -p web → dist/) |
| CI/CD | GitHub Actions (.github/workflows/deploy.yml) |
| 예정 백엔드 | Supabase (Auth + PostgreSQL) |

---

## 파일 구조
```
app/
  _layout.tsx          # Stack 네비게이터 (다크 테마)
  index.tsx            # 홈 화면 "Baek's test Games"
  jamo-wordle/
    index.tsx          # 단어 맞추기 게임 메인 로직
components/
  GameBoard.tsx        # 5×5 타일 그리드
  JamoKeyboard.tsx     # 자모 키보드 (9+9+7 배열, 고정 크기)
  StatsModal.tsx       # 게임 결과 + 통계 팝업
utils/
  jamo.ts              # decomposeWord, decomposeToKeystrokes
  gameLogic.ts         # evaluateGuess, isValidKeystroke
  storage.ts           # AsyncStorage CRUD
constants/
  wordList.ts          # 5 키스트로크 단어 목록 + getTodayWord()
```

---

## 핵심 게임 규칙
- **입력 단위**: 키스트로크 (합성모음은 2칸 — ㅔ=ㅓ+ㅣ, ㅐ=ㅏ+ㅣ)
- **단어 조건**: 키스트로크 정확히 5개인 2글자 한국어 단어
- **예시**: 세수 = ㅅ+ㅓ+ㅣ+ㅅ+ㅜ (5칸 ✓), 새벽 = ㅅ+ㅏ+ㅣ+ㅂ+ㅕ+ㄱ (6칸 ✗)
- **색상**: 초록(위치+자모 일치), 노랑(자모만 일치), 회색(없음)
- **시도**: 최대 5번
- **치트 방지**: isValidKeystroke()로 자음만/모음만 입력 차단
- **정답 비공개**: 화면에 표시 안 함, 팝업에서만 공개

## 중요한 설계 결정
- 키보드: 모든 키 동일 크기 (36×44px), maxWidth로 화면 맞춤
- 단어 필터: decomposeToKeystrokes(w).length === 5 조건
- npm install 시 항상 --legacy-peer-deps 필요

---

## 개발 환경 세팅 (새 컴퓨터)
```bash
git clone https://github.com/Rach0209/miniGames.git
cd miniGames
npm install --legacy-peer-deps
npx expo start --web
```

---

## 다음 작업 (Phase 2 — Supabase 연동)
- [ ] Supabase 프로젝트 생성 (supabase.com, GitHub Rach0209로 로그인)
- [ ] Google 로그인 연동
- [ ] 통계 DB 저장 (현재는 AsyncStorage 로컬만)
- [ ] 단어 API (오늘의 단어를 서버에서 제공 → 소스코드에서 제거)
- [ ] 비로그인도 로컬 저장으로 유지 (선택적 로그인)

### Supabase DB 구조 (예정)
```sql
-- Supabase Auth가 users 테이블 자동 생성
game_stats (
  id, user_id, game_type,
  total_games, wins, current_streak, max_streak,
  distribution jsonb, updated_at
)
daily_words (
  id, game_type, date, word  -- word는 클라이언트에 절대 노출 안 함
)
```

---

## 사용자 정보
- GitHub: Rach0209
- 백엔드 선호: Java (Spring Boot) — Phase 3에서 도입 예정
- 기기: iPhone, iPad (Android 실기기 없음 → Expo Go로 테스트)
- IDE: IntelliJ IDEA 보유
- 목표: 여러 미니게임 추가 + iOS/Android 앱 출시
