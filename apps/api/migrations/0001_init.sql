-- OneJellyInvest D1 Database Schema
-- 한국 주식 정보 앱 (중립적 정보 제공, 추천/분석 금지)

-- ============================================
-- 1. 기업 마스터 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS corp_master (
    corp_code TEXT PRIMARY KEY,
    stock_code TEXT UNIQUE,
    corp_name TEXT NOT NULL,
    corp_name_eng TEXT,
    market TEXT CHECK (market IN ('KOSPI', 'KOSDAQ', 'KONEX', 'UNLISTED')),
    industry_code TEXT,
    industry_name TEXT,
    listing_date TEXT,
    is_active INTEGER DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_corp_stock ON corp_master(stock_code);
CREATE INDEX IF NOT EXISTS idx_corp_industry ON corp_master(industry_code);
CREATE INDEX IF NOT EXISTS idx_corp_active ON corp_master(is_active, market);

-- ============================================
-- 2. 업종 마스터 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS industry_master (
    industry_code TEXT PRIMARY KEY,
    industry_name TEXT NOT NULL,
    industry_group TEXT,
    display_order INTEGER DEFAULT 0
);

-- ============================================
-- 3. Peer Group 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS peer_group (
    peer_code TEXT PRIMARY KEY,
    peer_name TEXT NOT NULL,
    description TEXT,
    is_auto_mapped INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS corp_peer_map (
    corp_code TEXT NOT NULL,
    peer_code TEXT NOT NULL,
    is_manual INTEGER DEFAULT 0,
    mapped_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (corp_code, peer_code),
    FOREIGN KEY (corp_code) REFERENCES corp_master(corp_code) ON DELETE CASCADE,
    FOREIGN KEY (peer_code) REFERENCES peer_group(peer_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cpm_peer ON corp_peer_map(peer_code);

-- ============================================
-- 4. 뉴스 기사 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS news_article (
    url TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    published_at TEXT NOT NULL,
    preview_image_url TEXT,
    category TEXT NOT NULL DEFAULT 'economy',
    hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news_article(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_article(source, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_created ON news_article(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news_article(category, published_at DESC);

-- ============================================
-- 5. 공시 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS disclosure (
    rcept_no TEXT PRIMARY KEY,
    corp_code TEXT NOT NULL,
    stock_code TEXT,
    corp_name TEXT NOT NULL,
    disclosed_at TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('실적', '수주계약', '자본', '주주가치', '지배구조', '리스크', '기타')),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    key_json TEXT,
    source_url TEXT NOT NULL,
    is_correction INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (corp_code) REFERENCES corp_master(corp_code)
);

CREATE INDEX IF NOT EXISTS idx_disclosure_corp ON disclosure(corp_code, disclosed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosure_stock ON disclosure(stock_code, disclosed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosure_category ON disclosure(category, disclosed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosure_date ON disclosure(disclosed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosure_type ON disclosure(type, disclosed_at DESC);

-- ============================================
-- 6. 분기 재무 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS financial_quarter (
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
    source_priority INTEGER DEFAULT 0,  -- 0:잠정, 1:분기, 2:반기, 3:사업보고서
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (corp_code) REFERENCES corp_master(corp_code),
    FOREIGN KEY (source_rcept_no) REFERENCES disclosure(rcept_no)
);

CREATE INDEX IF NOT EXISTS idx_fq_corp ON financial_quarter(corp_code, year DESC, quarter DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fq_unique ON financial_quarter(corp_code, year, quarter);

-- ============================================
-- 7. TTM 재무 테이블 (최근 4분기 합산)
-- ============================================
CREATE TABLE IF NOT EXISTS financial_ttm (
    corp_code TEXT PRIMARY KEY,
    revenue_ttm REAL,
    op_profit_ttm REAL,
    net_profit_ttm REAL,
    total_equity REAL,
    total_debt REAL,
    shares_outstanding INTEGER,
    last_quarter_year INTEGER,
    last_quarter INTEGER,
    calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (corp_code) REFERENCES corp_master(corp_code)
);

CREATE INDEX IF NOT EXISTS idx_ttm_calc ON financial_ttm(calculated_at DESC);

-- ============================================
-- 8. 일별 시세 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS price_daily (
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

CREATE INDEX IF NOT EXISTS idx_price_stock ON price_daily(stock_code, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_price_date ON price_daily(trade_date DESC);

-- ============================================
-- 9. 밸류에이션 스냅샷 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS valuation_snapshot (
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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (corp_code) REFERENCES corp_master(corp_code),
    FOREIGN KEY (peer_code) REFERENCES peer_group(peer_code)
);

CREATE INDEX IF NOT EXISTS idx_vs_corp_date ON valuation_snapshot(corp_code, snap_date DESC);
CREATE INDEX IF NOT EXISTS idx_vs_date ON valuation_snapshot(snap_date DESC);
CREATE INDEX IF NOT EXISTS idx_vs_peer ON valuation_snapshot(peer_code, snap_date DESC);
CREATE INDEX IF NOT EXISTS idx_vs_score ON valuation_snapshot(snap_date DESC, valuation_score DESC);

-- ============================================
-- 10. 배치 작업 로그 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS batch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_type TEXT NOT NULL CHECK (batch_type IN ('disclosure', 'news', 'valuation', 'financial')),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT CHECK (status IN ('running', 'success', 'failed', 'partial')),
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    error_message TEXT,
    metadata TEXT  -- JSON
);

CREATE INDEX IF NOT EXISTS idx_batch_type ON batch_log(batch_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_status ON batch_log(status, started_at DESC);

-- ============================================
-- 초기 Peer Group 데이터
-- ============================================
INSERT OR IGNORE INTO peer_group (peer_code, peer_name, description) VALUES
('SEMI', '반도체', '반도체 설계, 제조, 장비'),
('IT_SW', 'IT/소프트웨어', '소프트웨어, 인터넷, 플랫폼'),
('BIO', '바이오/헬스케어', '제약, 바이오, 의료기기'),
('AUTO', '자동차/부품', '완성차, 자동차 부품'),
('CHEM', '화학/에너지', '화학, 정유, 2차전지'),
('SHIP', '조선/해운', '조선, 해운, 중공업'),
('STEEL', '철강/금속', '철강, 비철금속'),
('CONST', '건설/건자재', '건설, 시멘트, 건자재'),
('BANK', '은행/보험', '은행, 보험, 카드'),
('SEC', '증권/금융', '증권, 자산운용'),
('RETAIL', '유통/소매', '백화점, 마트, 이커머스'),
('FOOD', '음식료', '식품, 음료'),
('TELCO', '통신', '이동통신, 유선통신'),
('UTIL', '전력/가스', '전력, 가스, 유틸리티'),
('MEDIA', '미디어/엔터', '방송, 게임, 엔터테인먼트'),
('TRANS', '운송/물류', '항공, 육운, 물류'),
('MACH', '기계/장비', '산업기계, 전기장비'),
('OTHER', '기타', '분류 미정');

-- ============================================
-- 초기 업종 데이터 (KRX 기준 표시용)
-- ============================================
INSERT OR IGNORE INTO industry_master (industry_code, industry_name, industry_group, display_order) VALUES
('G25', '반도체', '제조업', 1),
('G26', '전자부품', '제조업', 2),
('G27', '정보기기', '제조업', 3),
('G28', '소프트웨어', 'IT서비스', 4),
('G29', '인터넷', 'IT서비스', 5),
('G31', '제약', '바이오', 6),
('G32', '바이오', '바이오', 7),
('G35', '자동차', '제조업', 8),
('G36', '자동차부품', '제조업', 9),
('G41', '화학', '제조업', 10),
('G42', '정유', '제조업', 11),
('G45', '철강', '제조업', 12),
('G51', '건설', '건설업', 13),
('G61', '은행', '금융업', 14),
('G62', '증권', '금융업', 15),
('G63', '보험', '금융업', 16),
('G71', '유통', '서비스업', 17),
('G72', '음식료', '제조업', 18),
('G81', '통신', '서비스업', 19),
('G82', '미디어', '서비스업', 20),
('G99', '기타', '기타', 99);
