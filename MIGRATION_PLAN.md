# OneJellyInvest 마이그레이션 계획

## 개요
Firebase + Next.js 기반에서 Cloudflare Workers + D1으로 전환하면서
모든 "추천", "분석", "전망" 관련 기능을 제거하고 중립적 정보 제공 앱으로 재구축

---

## 1. 제거해야 할 기능/로직 목록

### 1.1 완전 삭제 대상

| 파일/폴더 | 이유 |
|-----------|------|
| `/apps/web/src/lib/services/recommendations.ts` | 추천 엔진 전체 삭제 |
| `/apps/web/src/app/recommendations/` | 추천 페이지 삭제 |
| `/apps/web/src/app/api/recommendations/` | 추천 API 삭제 |
| `/apps/web/src/components/RecommendationCard.tsx` | 추천 UI 삭제 |
| `/packages/shared/src/types/news.ts` → `BuyPoint`, `buy_grade` | 매수 관련 타입 삭제 |
| `/packages/shared/src/scoring/news-scoring.ts` → `calculateBuyPoint`, `getBuyGrade` | 매수점수 로직 삭제 |

### 1.2 수정 후 유지 대상

| 파일 | 변경 내용 |
|------|-----------|
| `/packages/shared/src/types/index.ts` | label_5 → band_label 중립 문구로 변경 |
| `/packages/shared/src/scoring/index.ts` | impact_score → valuation_score로 변경, 룰 기반만 유지 |
| `/apps/web/src/lib/llm/prompts.ts` | AI 프롬프트를 "사실 한 줄 요약"으로 축소 |
| `/apps/web/src/lib/services/analyzer.ts` | LLM은 요약에만 사용, 점수는 코드 계산 |

### 1.3 삭제할 용어/표현

```
- STRONG_BUY, BUY, WATCH, CAUTION, AVOID
- 추천, 매수, 매도, 전망, 분석
- 강호재, 약호재, 강악재, 약악재 (호재/악재 용어)
- 저평가, 고평가
- buy_point, buy_grade, buy_reasons
- impact_score_suggestion (LLM이 점수 제안하는 것)
```

---

## 2. 새로운 아키텍처

### 2.1 기술 스택 변경

| Before | After |
|--------|-------|
| Firebase Firestore | Cloudflare D1 (SQLite) |
| Next.js API Routes | Cloudflare Workers |
| Vercel Cron | Cloudflare Cron Triggers |
| Vercel Hosting | Cloudflare Pages (optional) |

### 2.2 프로젝트 구조

```
/onejellyinvest/
├── apps/
│   ├── api/                    # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── index.ts        # Main worker entry
│   │   │   ├── routes/         # API handlers
│   │   │   ├── engines/        # 3개 분리 엔진
│   │   │   │   ├── news.ts     # 기사 엔진
│   │   │   │   ├── disclosure.ts # 공시 엔진
│   │   │   │   └── valuation.ts  # 지표 엔진
│   │   │   ├── batch/          # 배치 작업
│   │   │   └── db/             # D1 queries
│   │   └── wrangler.toml
│   ├── web/                    # 프론트엔드 (읽기 전용)
│   └── mobile/                 # 모바일 앱
└── packages/
    └── shared/                 # 공유 타입/유틸
```

---

## 3. D1 데이터베이스 스키마

### 3.1 기사 테이블 (news_article)

```sql
CREATE TABLE news_article (
    url TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    published_at TEXT NOT NULL,
    one_liner TEXT,
    hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_news_published ON news_article(published_at DESC);
CREATE INDEX idx_news_source ON news_article(source);
```

### 3.2 공시 테이블 (disclosure)

```sql
CREATE TABLE disclosure (
    rcept_no TEXT PRIMARY KEY,
    corp_code TEXT NOT NULL,
    stock_code TEXT,
    disclosed_at TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('실적', '수주계약', '자본', '주주가치', '지배구조', '리스크', '기타')),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    key_json TEXT,
    source_url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_disclosure_corp ON disclosure(corp_code, disclosed_at DESC);
CREATE INDEX idx_disclosure_stock ON disclosure(stock_code, disclosed_at DESC);
CREATE INDEX idx_disclosure_category ON disclosure(category, disclosed_at DESC);
CREATE INDEX idx_disclosure_date ON disclosure(disclosed_at DESC);
```

### 3.3 분기 재무 테이블 (financial_quarter)

```sql
CREATE TABLE financial_quarter (
    id TEXT PRIMARY KEY,  -- {corp_code}_{year}Q{quarter}
    corp_code TEXT NOT NULL,
    year INTEGER NOT NULL,
    quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
    revenue REAL,
    op_profit REAL,
    net_profit REAL,
    total_equity REAL,
    total_debt REAL,
    total_assets REAL,
    shares_outstanding INTEGER,
    is_consolidated INTEGER DEFAULT 1,
    source_rcept_no TEXT,
    source_priority INTEGER DEFAULT 0,  -- 0:잠정, 1:분기, 2:반기, 3:사업
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_fq_corp ON financial_quarter(corp_code, year DESC, quarter DESC);
CREATE UNIQUE INDEX idx_fq_unique ON financial_quarter(corp_code, year, quarter);
```

### 3.4 TTM 재무 테이블 (financial_ttm)

```sql
CREATE TABLE financial_ttm (
    corp_code TEXT PRIMARY KEY,
    revenue_ttm REAL,
    op_profit_ttm REAL,
    net_profit_ttm REAL,
    total_equity REAL,
    total_debt REAL,
    shares_outstanding INTEGER,
    last_quarter_year INTEGER,
    last_quarter INTEGER,
    calculated_at TEXT NOT NULL
);

CREATE INDEX idx_ttm_calc ON financial_ttm(calculated_at DESC);
```

### 3.5 기업 마스터 (corp_master)

```sql
CREATE TABLE corp_master (
    corp_code TEXT PRIMARY KEY,
    stock_code TEXT UNIQUE,
    corp_name TEXT NOT NULL,
    corp_name_eng TEXT,
    market TEXT CHECK (market IN ('KOSPI', 'KOSDAQ', 'KONEX', 'UNLISTED')),
    industry_code TEXT,
    industry_name TEXT,
    listing_date TEXT,
    is_active INTEGER DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_corp_stock ON corp_master(stock_code);
CREATE INDEX idx_corp_industry ON corp_master(industry_code);
```

### 3.6 업종 마스터 (industry_master)

```sql
CREATE TABLE industry_master (
    industry_code TEXT PRIMARY KEY,
    industry_name TEXT NOT NULL,
    industry_group TEXT,
    display_order INTEGER DEFAULT 0
);
```

### 3.7 Peer Group 테이블

```sql
CREATE TABLE peer_group (
    peer_code TEXT PRIMARY KEY,
    peer_name TEXT NOT NULL,
    description TEXT,
    is_auto_mapped INTEGER DEFAULT 1
);

CREATE TABLE corp_peer_map (
    corp_code TEXT NOT NULL,
    peer_code TEXT NOT NULL,
    is_manual INTEGER DEFAULT 0,
    mapped_at TEXT NOT NULL,
    PRIMARY KEY (corp_code, peer_code),
    FOREIGN KEY (corp_code) REFERENCES corp_master(corp_code),
    FOREIGN KEY (peer_code) REFERENCES peer_group(peer_code)
);

CREATE INDEX idx_cpm_peer ON corp_peer_map(peer_code);
```

### 3.8 밸류에이션 스냅샷 (valuation_snapshot)

```sql
CREATE TABLE valuation_snapshot (
    id TEXT PRIMARY KEY,  -- {corp_code}_{snap_date}
    corp_code TEXT NOT NULL,
    snap_date TEXT NOT NULL,
    market_cap REAL,
    price REAL,
    per_ttm REAL,
    pbr REAL,
    psr_ttm REAL,
    roe_ttm REAL,
    opm_ttm REAL,
    debt_ratio REAL,
    peer_code TEXT,
    per_percentile REAL,
    pbr_percentile REAL,
    psr_percentile REAL,
    roe_percentile REAL,
    opm_percentile REAL,
    valuation_score INTEGER CHECK (valuation_score BETWEEN 0 AND 100),
    band_label TEXT CHECK (band_label IN ('상단', '양호', '중립', '하단', '매우하단')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_vs_corp_date ON valuation_snapshot(corp_code, snap_date DESC);
CREATE INDEX idx_vs_date ON valuation_snapshot(snap_date DESC);
CREATE INDEX idx_vs_peer ON valuation_snapshot(peer_code, snap_date DESC);
```

### 3.9 시세 테이블 (price_daily)

```sql
CREATE TABLE price_daily (
    id TEXT PRIMARY KEY,  -- {stock_code}_{date}
    stock_code TEXT NOT NULL,
    trade_date TEXT NOT NULL,
    open_price REAL,
    high_price REAL,
    low_price REAL,
    close_price REAL,
    volume INTEGER,
    market_cap REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_price_stock ON price_daily(stock_code, trade_date DESC);
CREATE INDEX idx_price_date ON price_daily(trade_date DESC);
```

---

## 4. 배치 작업 흐름

### 4.1 기사 엔진 배치 (매 30분)

```
[기사 엔진 배치]
│
├─ 1. 신뢰 언론사 RSS/API 수집
│   ├─ 연합뉴스, 한국경제, 매일경제, 머니투데이 등
│   └─ 최근 1시간 기사만 대상
│
├─ 2. URL 중복 체크
│   └─ SELECT 1 FROM news_article WHERE url = ?
│
├─ 3. 기사 본문 크롤링
│   └─ 제목 + 본문 텍스트 추출 (HTML 제거)
│
├─ 4. AI 한 줄 요약 (1회만 호출)
│   ├─ 프롬프트: "다음 기사를 사실만 담은 한 문장으로 요약. 의견/추정/전망 금지"
│   ├─ 결과 캐시: one_liner 저장
│   └─ hash 생성하여 저장
│
└─ 5. news_article INSERT
```

### 4.2 공시 엔진 배치 (매 5분)

```
[공시 엔진 배치]
│
├─ 1. OpenDART API 호출
│   └─ 최근 24시간 공시 목록 조회
│
├─ 2. rcept_no 중복 체크
│   └─ SELECT 1 FROM disclosure WHERE rcept_no = ?
│
├─ 3. 공시 분류 (룰 기반)
│   ├─ 실적: 사업보고서, 분기보고서, 반기보고서, 잠정실적
│   ├─ 수주계약: 수주, 계약, 공급, 납품
│   ├─ 자본: 증자, 감자, CB, BW, 전환사채
│   ├─ 주주가치: 배당, 자사주, 주식소각
│   ├─ 지배구조: 임원, 이사회, 주총, 최대주주
│   ├─ 리스크: 소송, 횡령, 감사, 상폐, 관리종목
│   └─ 기타: 위에 해당 안 됨
│
├─ 4. 핵심 수치 추출 (룰 기반)
│   ├─ 실적 → 매출, 영업이익, 순이익, YoY 변동
│   ├─ 수주 → 계약금액, 매출대비율
│   ├─ 배당 → 주당배당금, 배당수익률
│   └─ key_json으로 저장
│
├─ 5. disclosure INSERT
│
└─ 6. 실적 공시인 경우 → 재무 반영 트리거
    └─ call updateFinancialQuarter()
```

### 4.3 재무 반영 로직

```
[실적 공시 → 재무 반영]
│
├─ 1. 공시 유형 우선순위 확인
│   ├─ 사업보고서 (priority=3)
│   ├─ 분기/반기보고서 (priority=2)
│   ├─ 잠정실적 (priority=1)
│   └─ 기타 (priority=0)
│
├─ 2. 기존 레코드 확인
│   └─ SELECT source_priority FROM financial_quarter WHERE corp_code=? AND year=? AND quarter=?
│
├─ 3. 우선순위 비교
│   ├─ 새 공시 priority >= 기존 → 덮어쓰기
│   └─ 새 공시 priority < 기존 → 무시
│
├─ 4. financial_quarter UPSERT
│
└─ 5. TTM 재계산
    ├─ 최근 4개 분기 합산
    └─ financial_ttm UPSERT
```

### 4.4 지표 엔진 배치 (매일 16:00 KST)

```
[지표 엔진 배치 - 장마감 후 1일 1회]
│
├─ 1. 당일 종가 수집
│   ├─ KRX API 또는 크롤링
│   └─ price_daily INSERT
│
├─ 2. 시가총액 계산
│   └─ market_cap = close_price × shares_outstanding
│
├─ 3. 지표 계산 (각 종목별)
│   ├─ PER(TTM) = market_cap / net_profit_ttm
│   ├─ PBR = market_cap / total_equity
│   ├─ PSR(TTM) = market_cap / revenue_ttm
│   ├─ ROE(TTM) = net_profit_ttm / total_equity × 100
│   ├─ OPM(TTM) = op_profit_ttm / revenue_ttm × 100
│   └─ 부채비율 = total_debt / total_equity × 100
│
├─ 4. Peer Group별 퍼센타일 계산
│   ├─ 같은 peer_code 내에서
│   ├─ 각 지표별 순위 → 퍼센타일 변환
│   └─ (순위 / 총개수) × 100
│
├─ 5. valuation_score 계산
│   ├─ 가중치: PER 25%, PBR 20%, PSR 15%, ROE 20%, OPM 20%
│   ├─ 역방향 지표(PER, PBR, PSR)는 100 - percentile
│   ├─ 정방향 지표(ROE, OPM)는 percentile 그대로
│   └─ 가중평균 → 0~100 점수
│
├─ 6. band_label 결정
│   ├─ >= 80: 상단
│   ├─ >= 60: 양호
│   ├─ >= 40: 중립
│   ├─ >= 20: 하단
│   └─ < 20: 매우하단
│
└─ 7. valuation_snapshot INSERT
```

---

## 5. 엔진 분리 구조

### 5.1 기사 엔진 (NewsEngine)

```typescript
// /apps/api/src/engines/news.ts

interface NewsSource {
  id: string;
  name: string;
  feedUrl: string;
  crawlFn: (url: string) => Promise<string>;
}

class NewsEngine {
  private db: D1Database;
  private ai: Ai;
  private sources: NewsSource[];

  async fetchNewArticles(): Promise<number> {
    // RSS/API에서 새 기사 수집
  }

  async isDuplicate(url: string): Promise<boolean> {
    // URL 중복 확인
  }

  async crawlContent(url: string, source: NewsSource): Promise<string> {
    // 본문 크롤링
  }

  async generateOneLiner(title: string, content: string): Promise<string> {
    // AI 한 줄 요약 (1회만)
    // 프롬프트: 사실만, 의견/추정 금지
  }

  async saveArticle(article: NewsArticle): Promise<void> {
    // DB 저장
  }
}
```

### 5.2 공시 엔진 (DisclosureEngine)

```typescript
// /apps/api/src/engines/disclosure.ts

const CATEGORY_RULES = {
  '실적': ['사업보고서', '분기보고서', '반기보고서', '잠정실적', '매출액'],
  '수주계약': ['수주', '계약', '공급', '납품'],
  '자본': ['증자', '감자', 'CB', 'BW', '전환사채', '신주인수권'],
  '주주가치': ['배당', '자사주', '주식소각', '자기주식'],
  '지배구조': ['임원', '이사회', '주총', '최대주주', '대표이사'],
  '리스크': ['소송', '횡령', '배임', '감사', '상폐', '관리종목', '회생'],
};

class DisclosureEngine {
  private db: D1Database;
  private dartClient: OpenDartClient;

  async pollNewDisclosures(): Promise<number> {
    // OpenDART API 호출
  }

  classifyCategory(title: string): Category {
    // 룰 기반 분류
    for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
      if (keywords.some(kw => title.includes(kw))) {
        return category as Category;
      }
    }
    return '기타';
  }

  extractKeyNumbers(category: Category, content: string): Record<string, any> {
    // 룰 기반 수치 추출 (정규식)
  }

  async saveDisclosure(disclosure: Disclosure): Promise<void> {
    // DB 저장
  }

  async triggerFinancialUpdate(disclosure: Disclosure): Promise<void> {
    // 실적 공시면 재무 업데이트 호출
  }
}
```

### 5.3 지표 엔진 (ValuationEngine)

```typescript
// /apps/api/src/engines/valuation.ts

interface ValuationMetrics {
  per_ttm: number | null;
  pbr: number | null;
  psr_ttm: number | null;
  roe_ttm: number | null;
  opm_ttm: number | null;
  debt_ratio: number | null;
}

const BAND_LABELS = {
  80: '상단',
  60: '양호',
  40: '중립',
  20: '하단',
  0: '매우하단',
} as const;

const SCORE_WEIGHTS = {
  per: 0.25,
  pbr: 0.20,
  psr: 0.15,
  roe: 0.20,
  opm: 0.20,
};

class ValuationEngine {
  private db: D1Database;

  async fetchDailyPrices(): Promise<void> {
    // KRX 종가 수집
  }

  async calculateTTM(corpCode: string): Promise<FinancialTTM> {
    // 최근 4개 분기 합산
  }

  calculateMetrics(ttm: FinancialTTM, price: PriceDaily): ValuationMetrics {
    // PER, PBR, PSR, ROE, OPM, 부채비율 계산
  }

  async calculatePeerPercentiles(peerCode: string, date: string): Promise<Map<string, PercentileResult>> {
    // Peer Group 내 퍼센타일 계산
  }

  calculateValuationScore(percentiles: PercentileResult): number {
    // 가중 평균으로 0~100 점수 산출
    const inverted = (100 - percentiles.per) * SCORE_WEIGHTS.per
                   + (100 - percentiles.pbr) * SCORE_WEIGHTS.pbr
                   + (100 - percentiles.psr) * SCORE_WEIGHTS.psr;
    const direct = percentiles.roe * SCORE_WEIGHTS.roe
                 + percentiles.opm * SCORE_WEIGHTS.opm;
    return Math.round(inverted + direct);
  }

  getBandLabel(score: number): string {
    if (score >= 80) return '상단';
    if (score >= 60) return '양호';
    if (score >= 40) return '중립';
    if (score >= 20) return '하단';
    return '매우하단';
  }

  async saveSnapshot(snapshot: ValuationSnapshot): Promise<void> {
    // DB 저장
  }
}
```

---

## 6. D1 무료 한도 최적화

### 6.1 쓰기 최소화 전략

| 작업 | 전략 | 예상 쓰기/일 |
|------|------|-------------|
| 기사 | URL 중복 체크 후 INSERT | ~100건 |
| 공시 | rcept_no 중복 체크 후 INSERT | ~200건 |
| 스냅샷 | 하루 1회만 (장마감 후) | ~2,500건 |
| 재무 | 공시 발생 시에만 | ~50건 |
| **합계** | | ~2,850건/일 |

D1 무료: 100,000 쓰기/일 → **여유 충분**

### 6.2 읽기 최소화 전략

| 작업 | 전략 | 예상 읽기/일 |
|------|------|-------------|
| 중복 체크 | EXISTS 쿼리 사용 | ~300건 |
| 피드 조회 | LIMIT + 최소 컬럼 | ~1,000건 |
| 상세 조회 | 단건 조회 | ~500건 |
| 퍼센타일 | Peer별 배치 계산 | ~50건 |
| **합계** | | ~1,850건/일 |

D1 무료: 5,000,000 읽기/일 → **여유 충분**

### 6.3 최적화 기법

```sql
-- 1. EXISTS로 중복 체크 (전체 로드 방지)
SELECT EXISTS(SELECT 1 FROM news_article WHERE url = ?);

-- 2. 최소 컬럼 조회
SELECT corp_code, title, disclosed_at, category
FROM disclosure
ORDER BY disclosed_at DESC
LIMIT 20;

-- 3. 커버링 인덱스 활용
CREATE INDEX idx_vs_list ON valuation_snapshot(snap_date, corp_code, valuation_score, band_label);

-- 4. 배치 INSERT
INSERT INTO valuation_snapshot (id, corp_code, ...) VALUES
(?, ?, ...), (?, ?, ...), (?, ?, ...);
```

---

## 7. UI 데이터 출력 방식 (법적 리스크 최소화)

### 7.1 금지 표현

```
❌ 저평가 / 고평가
❌ 추천 / 매수 / 매도
❌ 상승 전망 / 하락 예상
❌ 투자 의견 / 투자 판단
❌ 호재 / 악재
❌ 목표가 / 적정가
```

### 7.2 허용 표현 (중립 문구만)

```
✅ "업종 대비 지표 상단" (score >= 80)
✅ "업종 대비 지표 양호" (score >= 60)
✅ "업종 대비 지표 중립" (score >= 40)
✅ "업종 대비 지표 하단" (score >= 20)
✅ "업종 대비 지표 매우 하단" (score < 20)
```

### 7.3 UI 표시 예시

```
┌─────────────────────────────────────┐
│ 삼성전자 (005930)                    │
│ 반도체 / 전자                        │
├─────────────────────────────────────┤
│ PER(TTM)  8.5    업종 상위 15%       │
│ PBR      1.2    업종 중간            │
│ ROE(TTM) 12.3%  업종 상위 30%       │
├─────────────────────────────────────┤
│ 종합 상태: 업종 대비 지표 양호       │
│ (이 정보는 투자 조언이 아닙니다)     │
└─────────────────────────────────────┘
```

### 7.4 면책 문구 (모든 페이지 하단)

```
본 서비스는 공시 및 재무 정보를 정리하여 제공하며,
투자 조언이나 추천을 목적으로 하지 않습니다.
모든 투자 결정은 이용자 본인의 판단과 책임 하에 이루어져야 합니다.
제공 정보의 정확성을 보장하지 않으며, 정보 이용으로 인한 손실에 대해 책임지지 않습니다.
```

### 7.5 기사 요약 표시 원칙

```
✅ 기사 제목 (원문 링크)
✅ 한 줄 요약: "삼성전자, 2분기 매출 74조원 기록" (사실만)

❌ 한 줄 요약에 포함 금지:
   - "전망이 밝다", "우려된다"
   - "투자자들의 관심", "상승 기대"
   - "긍정적", "부정적" 평가
```

---

## 8. 마이그레이션 순서

### Phase 1: 인프라 설정
1. Cloudflare Workers 프로젝트 생성
2. D1 데이터베이스 생성
3. 스키마 마이그레이션 실행
4. 환경변수 설정

### Phase 2: 엔진 구현
1. 공시 엔진 (가장 핵심)
2. 지표 엔진
3. 기사 엔진

### Phase 3: API 구현
1. 읽기 전용 API 엔드포인트
2. 배치 트리거 (Cron)

### Phase 4: 프론트엔드 수정
1. 추천 관련 UI 제거
2. 중립 문구 적용
3. 면책 문구 추가

### Phase 5: 테스트 및 배포
1. 로컬 테스트
2. 스테이징 배포
3. 프로덕션 배포
