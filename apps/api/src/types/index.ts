// OneJellyInvest API Types
// 중립적 정보 제공 (추천/분석 표현 금지)

// ============================================
// Environment & Bindings
// ============================================
export interface Env {
  DB: D1Database;
  AI: Ai;
  ENVIRONMENT: string;
  OPENDART_API_KEY?: string;
  OPENAI_API_KEY?: string;
  KRX_API_KEY?: string;
  KRX_KOSPI_API_URL?: string;
  KRX_KOSDAQ_API_URL?: string;
  KRX_SOURCE?: string;
  KRX_PUBLIC_KOSPI_URL?: string;
  KRX_PUBLIC_KOSDAQ_URL?: string;
  KRX_USE_MOCK?: string;
}

// ============================================
// 공시 카테고리 (6개 대분류 + 기타)
// ============================================
export const DISCLOSURE_CATEGORIES = [
  '실적',
  '수주계약',
  '자본',
  '주주가치',
  '지배구조',
  '리스크',
  '기타',
] as const;

export type DisclosureCategory = (typeof DISCLOSURE_CATEGORIES)[number];

// ============================================
// 밴드 라벨 (중립 문구만)
// ============================================
export const BAND_LABELS = {
  TOP: '상단',
  GOOD: '양호',
  NEUTRAL: '중립',
  LOW: '하단',
  VERY_LOW: '매우하단',
} as const;

export type BandLabel = (typeof BAND_LABELS)[keyof typeof BAND_LABELS];

// ============================================
// 시장 구분
// ============================================
export type MarketType = 'KOSPI' | 'KOSDAQ' | 'KONEX' | 'UNLISTED';

// ============================================
// 기업 마스터
// ============================================
export interface CorpMaster {
  corp_code: string;
  stock_code: string | null;
  corp_name: string;
  corp_name_eng: string | null;
  market: MarketType | null;
  industry_code: string | null;
  industry_name: string | null;
  listing_date: string | null;
  is_active: boolean;
  updated_at: string;
}

// ============================================
// 뉴스 기사
// ============================================
export interface NewsArticle {
  url: string;
  source: string;
  title: string;
  published_at: string;
  one_liner: string | null;
  hash: string;
  created_at: string;
}

export interface NewsArticleInput {
  url: string;
  source: string;
  title: string;
  published_at: string;
  content: string; // 요약 생성용 (DB 저장 안 함)
}

// ============================================
// 공시
// ============================================
export interface Disclosure {
  rcept_no: string;
  corp_code: string;
  stock_code: string | null;
  corp_name: string;
  disclosed_at: string;
  category: DisclosureCategory;
  type: string;
  title: string;
  key_json: Record<string, unknown> | null;
  source_url: string;
  is_correction: boolean;
  created_at: string;
}

export interface DisclosureKeyNumbers {
  // 실적
  revenue?: number;
  revenue_yoy?: number;
  op_profit?: number;
  op_profit_yoy?: number;
  net_profit?: number;
  net_profit_yoy?: number;
  // 수주/계약
  contract_amount?: number;
  contract_ratio?: number; // 매출 대비 %
  // 배당
  dividend_per_share?: number;
  dividend_yield?: number;
  // 자본
  capital_amount?: number;
  dilution_ratio?: number;
}

// ============================================
// 분기 재무
// ============================================
export interface FinancialQuarter {
  id: string;
  corp_code: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  revenue: number | null;
  op_profit: number | null;
  net_profit: number | null;
  total_equity: number | null;
  total_debt: number | null;
  total_assets: number | null;
  shares_outstanding: number | null;
  is_consolidated: boolean;
  source_rcept_no: string | null;
  source_priority: number; // 0:잠정, 1:분기, 2:반기, 3:사업보고서
  updated_at: string;
}

// ============================================
// TTM 재무 (최근 4분기 합산)
// ============================================
export interface FinancialTTM {
  corp_code: string;
  revenue_ttm: number | null;
  op_profit_ttm: number | null;
  net_profit_ttm: number | null;
  total_equity: number | null;
  total_debt: number | null;
  shares_outstanding: number | null;
  last_quarter_year: number | null;
  last_quarter: number | null;
  calculated_at: string;
}

// ============================================
// 일별 시세
// ============================================
export interface PriceDaily {
  id: string;
  stock_code: string;
  trade_date: string;
  open_price: number | null;
  high_price: number | null;
  low_price: number | null;
  close_price: number | null;
  volume: number | null;
  market_cap: number | null;
  created_at: string;
}

// ============================================
// 밸류에이션 스냅샷
// ============================================
export interface ValuationSnapshot {
  id: string;
  corp_code: string;
  snap_date: string;
  market_cap: number | null;
  price: number | null;
  per_ttm: number | null;
  pbr: number | null;
  psr_ttm: number | null;
  roe_ttm: number | null;
  opm_ttm: number | null;
  debt_ratio: number | null;
  peer_code: string | null;
  per_percentile: number | null;
  pbr_percentile: number | null;
  psr_percentile: number | null;
  roe_percentile: number | null;
  opm_percentile: number | null;
  valuation_score: number | null;
  band_label: BandLabel | null;
  created_at: string;
}

// ============================================
// Peer Group
// ============================================
export interface PeerGroup {
  peer_code: string;
  peer_name: string;
  description: string | null;
  is_auto_mapped: boolean;
  created_at: string;
}

export interface CorpPeerMap {
  corp_code: string;
  peer_code: string;
  is_manual: boolean;
  mapped_at: string;
}

// ============================================
// 배치 로그
// ============================================
export type BatchType = 'disclosure' | 'news' | 'valuation' | 'financial';
export type BatchStatus = 'running' | 'success' | 'failed' | 'partial';

export interface BatchLog {
  id: number;
  batch_type: BatchType;
  started_at: string;
  finished_at: string | null;
  status: BatchStatus;
  items_processed: number;
  items_failed: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

// ============================================
// API 응답 타입
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// ============================================
// OpenDART API 타입
// ============================================
export interface DartListItem {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  corp_cls: string;
  report_nm: string;
  rcept_no: string;
  flr_nm: string;
  rcept_dt: string;
  rm: string;
}

export interface DartListResponse {
  status: string;
  message: string;
  page_no: number;
  page_count: number;
  total_count: number;
  total_page: number;
  list: DartListItem[];
}

// ============================================
// UI 표시용 타입 (중립 문구)
// ============================================
export interface StockValuationView {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  market: MarketType;
  industry_name: string;
  peer_name: string;
  snap_date: string;
  price: number;
  market_cap: number;
  metrics: {
    per_ttm: { value: number | null; percentile_label: string };
    pbr: { value: number | null; percentile_label: string };
    psr_ttm: { value: number | null; percentile_label: string };
    roe_ttm: { value: number | null; percentile_label: string };
    opm_ttm: { value: number | null; percentile_label: string };
    debt_ratio: { value: number | null; percentile_label: string };
  };
  overall_label: string; // "업종 대비 지표 양호" 등
  valuation_score: number;
}

// 퍼센타일 라벨 (중립 문구)
export function getPercentileLabel(percentile: number | null): string {
  if (percentile === null) return '데이터 없음';
  if (percentile >= 80) return '업종 상위 20%';
  if (percentile >= 60) return '업종 상위 40%';
  if (percentile >= 40) return '업종 중간';
  if (percentile >= 20) return '업종 하위 40%';
  return '업종 하위 20%';
}

// 밴드 라벨 변환 (점수 → 중립 문구)
export function getBandLabel(score: number | null): BandLabel {
  if (score === null) return BAND_LABELS.NEUTRAL;
  if (score >= 80) return BAND_LABELS.TOP;
  if (score >= 60) return BAND_LABELS.GOOD;
  if (score >= 40) return BAND_LABELS.NEUTRAL;
  if (score >= 20) return BAND_LABELS.LOW;
  return BAND_LABELS.VERY_LOW;
}

// 전체 라벨 문구 생성
export function getOverallLabel(bandLabel: BandLabel): string {
  return `업종 대비 지표 ${bandLabel}`;
}
