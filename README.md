# OneJellyInvest

한국 주식(KRX) 공시, 뉴스, 재무 지표를 **중립적으로 정리해 제공**하는 앱입니다.
투자 판단을 유도하는 기능은 없으며, 모든 계산은 서버 배치에서 수행됩니다.

## Features

- **공시 수집**: OpenDART API 기반 공시 수집 및 대분류 분류
- **뉴스 한 줄 요약**: 기사 1건당 AI 1회 호출, 사실 기반 1문장 요약만 저장
- **재무/지표 스냅샷**: TTM 계산 및 PER/PBR/PSR/ROE/OPM/부채비율 산출
- **Peer Group 퍼센타일**: 업종 표시용과 별도로 Peer Group 기준 퍼센타일 계산
- **읽기 전용 앱/웹**: 사용자 입력 없이 최신 데이터 조회만 제공

## Architecture

```
onejellyinvest/
├── apps/
│   ├── api/            # Cloudflare Workers API (D1)
│   ├── web/            # Next.js 웹 앱 (읽기 전용)
│   └── mobile/         # Expo React Native 모바일 앱 (읽기 전용)
├── packages/
│   └── shared/         # 공유 타입/유틸
```

## Tech Stack

- **Backend**: Cloudflare Workers + Hono
- **Database**: Cloudflare D1 (SQLite)
- **AI**: Cloudflare AI (기사 한 줄 요약에만 사용)
- **Frontend (Web)**: Next.js 14
- **Frontend (Mobile)**: Expo / React Native

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Cloudflare 계정
- OpenDART API 키

## Getting Started

### 1. 의존성 설치

```bash
pnpm install
```

### 2. Shared 패키지 빌드

```bash
pnpm --filter @onejellyinvest/shared build
```

### 3. Worker 실행 (로컬)

```bash
pnpm --filter @onejellyinvest/api dev
```

### 4. Web 실행 (로컬)

```bash
pnpm --filter web dev
```

### 5. Mobile 실행 (로컬)

```bash
pnpm --filter mobile start
```

## Environment Variables

### Worker (`apps/api/wrangler.toml` + Cloudflare Dashboard)

- `OPENDART_API_KEY` (필수, Worker Secret로만 설정)
- `ENVIRONMENT` (development/production)
- `KRX_SOURCE` (`public` | `api`, 기본: API 키 있으면 api, 없으면 public)
- `KRX_PUBLIC_KOSPI_URL` (공개 OTP URL, 예: `https://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd?locale=ko_KR&mktId=STK&trdDd={date}&money=1&csvxls_isNo=false&name=fileDown&url=dbms/MDC/STAT/standard/MDCSTAT03901`)
- `KRX_PUBLIC_KOSDAQ_URL` (공개 OTP URL, 예: `https://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd?locale=ko_KR&mktId=KSQ&trdDd={date}&money=1&csvxls_isNo=false&name=fileDown&url=dbms/MDC/STAT/standard/MDCSTAT03901`)
- `KRX_KOSPI_API_URL` (예: `http://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd?basDd={date}`)
- `KRX_KOSDAQ_API_URL` (예: `http://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd?basDd={date}`)
- `KRX_API_KEY` (KRX OpenAPI 키, `KRX_SOURCE=api`일 때 필요, Worker Secret)
- `KRX_USE_MOCK` (로컬 개발용 Mock 시세 사용, 값: `1`)

> IMPORTANT: 퍼블릭 레포에서는 `wrangler.toml` / 코드에 시크릿을 절대 커밋하지 않습니다.
> - 로컬: `apps/api/.dev.vars` (gitignore) 사용 (`apps/api/.dev.vars.example` 참고)
> - 운영: Cloudflare Worker Secrets 사용

### Web (`apps/web/.env.local`)

- `NEXT_PUBLIC_API_BASE_URL` (예: `http://localhost:8787`)

### Mobile (`apps/mobile/.env`)

- `EXPO_PUBLIC_API_URL` (예: `http://localhost:8787`)

## Android Debug APK (Expo) - Handoff Notes (2026-02-06)

### Summary
- 목표: Expo 기반 Android debug APK 빌드
- 현재 상태: 로컬 Windows에서 `gradlew assembleDebug` 진행 중이나, Expo/Gradle autolinking 및 `components.release` 관련 오류 반복
- 모든 변경사항은 GitHub `main`에 푸시됨. 최신 커밋 확인 필요.

### What Was Added/Changed
- `apps/mobile/android` 폴더를 repo에 포함
- `apps/mobile/android/settings.gradle`:
  - Expo/RN autolinking 스크립트 경로 fallback 로직 추가
  - pnpm `.pnpm` 경로에서 `@react-native-community/cli-platform-android` 탐색 로직 추가
  - `:expo` 모듈에 대해 `singleVariant("release")`를 조기 적용 시도
- `apps/mobile/android/build.gradle`:
  - Android library 모듈에 `compileSdk/minSdk/targetSdk` 강제 적용
  - publishing 관련 훅 여러 차례 조정
- `apps/mobile/android/gradle.properties`:
  - `android.disableAutomaticComponentCreation` 제거 (AGP 8 제거됨)
- `.gitignore`:
  - `.wrangler/` 무시 추가
  - `android/` 무시 제거
  - `*.keystore` 무시 추가

### Known Build Errors
1) **Expo modules**:  
   ```
   Could not get unknown property 'release' for SoftwareComponent container
   ```
   - `expo-modules-core`가 `components.release`를 기대하는데 생성되지 않음
2) **Autolinking path** (Windows/OneDrive 경로 및 pnpm 구조 문제):  
   - `expo/scripts/autolinking.gradle` 또는
   - `@react-native-community/cli-platform-android/native_modules.gradle`
   경로 탐색 실패

### Current Workarounds in Code
- `apps/mobile/android/settings.gradle`에서 다음 방식으로 탐색:
  - `node --print require.resolve(...)` 시도
  - `../node_modules`, `../../node_modules`, `../../../node_modules`, `../../../../node_modules` 후보
  - pnpm `.pnpm` 내부 후보(12.3.0, 20.1.1)
  - pnpm `.pnpm` 폴더 동적 탐색
- `:expo` 모듈에 대해 `singleVariant("release")` 조기 적용 시도

### Recommended Next Steps for Claude/Next Agent
1. **Autolinking/paths 단순화**
   - Windows 경로 이슈가 지속될 경우, 경로 탐색 로직을 최소화하고 실제 설치 위치만 지정
2. **Expo/AGP 호환**
   - Expo SDK 50 + RN 0.73 + AGP 8 조합에서 `components.release` 문제 해결 방식 검토
   - 필요 시 Gradle 플러그인/Expo 모듈 버전 정합성 확인
3. **빌드 재시도**
   - `pnpm install` 후
   - `apps/mobile/android/gradlew assembleDebug`

### Repro Commands (Windows CMD)
```
cd C:\dev\onejelly_investment
pnpm install
cd apps\mobile\android
gradlew assembleDebug
```

### Where to Look
- `apps/mobile/android/settings.gradle`
- `apps/mobile/android/build.gradle`
- `apps/mobile/android/gradle.properties`

## API Endpoints (Workers)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/feed` | 통합 피드 (공시 + 뉴스) |
| GET | `/api/disclosures` | 공시 목록 |
| GET | `/api/disclosures/:rcept_no` | 공시 상세 |
| GET | `/api/news` | 뉴스 목록 |
| GET | `/api/valuations` | 밸류에이션 스냅샷 목록 |
| GET | `/api/valuations/:corp_code` | 기업 밸류에이션 상세 |
| GET | `/api/valuations/peers/:peer_code` | Peer Group 비교 |
| GET | `/api/health` | 헬스 체크 |

## Neutral Label Rules

밸류에이션 점수는 **상태 지표**이며 투자 판단이 아닙니다.
표현은 아래 문구만 사용합니다.

- 업종 대비 지표 상단
- 업종 대비 지표 양호
- 업종 대비 지표 중립
- 업종 대비 지표 하단
- 업종 대비 지표 매우 하단

## Disclaimer

본 서비스는 공시 및 재무 정보를 정리해 제공하며, 투자 조언을 목적으로 하지 않습니다.
모든 투자 결정은 이용자 본인의 판단과 책임 하에 이루어져야 합니다.
제공 정보의 정확성을 보장하지 않으며, 정보 이용으로 인한 손실에 대해 책임지지 않습니다.
