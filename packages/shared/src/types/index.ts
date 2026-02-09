// ============================================
// OneJellyInvest Shared Types
// 중립적 정보 제공 (추천/분석 표현 금지)
// ============================================

// ============================================
// 공시 카테고리 (대분류)
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
// 밴드 라벨 (중립 문구)
// 금지: 저평가, 고평가, 추천, 호재, 악재
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
  preview_image_url: string | null;
  category: 'economy';
  hash: string;
  created_at: string;
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
  key_json: DisclosureKeyNumbers | null;
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
  contract_ratio?: number;
  // 배당
  dividend_per_share?: number;
  dividend_yield?: number;
  // 자본
  capital_amount?: number;
  dilution_ratio?: number;
  [key: string]: number | undefined;
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
  source_priority: number;
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
// 업종 (표시용)
// ============================================
export interface IndustryMaster {
  industry_code: string;
  industry_name: string;
  industry_group: string | null;
  display_order: number;
}

// ============================================
// API 응답 타입
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  disclaimer?: string;
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
// UI 표시용 헬퍼 함수 (중립 문구)
// ============================================

/**
 * 퍼센타일 → 중립 라벨 변환
 */
export function getPercentileLabel(percentile: number | null): string {
  if (percentile === null) return '데이터 없음';
  if (percentile >= 80) return '업종 상위 20%';
  if (percentile >= 60) return '업종 상위 40%';
  if (percentile >= 40) return '업종 중간';
  if (percentile >= 20) return '업종 하위 40%';
  return '업종 하위 20%';
}

/**
 * 점수 → 밴드 라벨 변환
 */
export function getBandLabel(score: number | null): BandLabel {
  if (score === null) return BAND_LABELS.NEUTRAL;
  if (score >= 80) return BAND_LABELS.TOP;
  if (score >= 60) return BAND_LABELS.GOOD;
  if (score >= 40) return BAND_LABELS.NEUTRAL;
  if (score >= 20) return BAND_LABELS.LOW;
  return BAND_LABELS.VERY_LOW;
}

/**
 * 전체 상태 라벨 문구 생성
 */
export function getOverallLabel(bandLabel: BandLabel): string {
  return `업종 대비 지표 ${bandLabel}`;
}

/**
 * 한글 금액 파싱 (예: "1조 2천억원" → 1200000000000)
 */
export function parseKoreanAmount(str: string): number | null {
  if (!str) return null;

  const cleaned = str.replace(/[,\s원]/g, '');
  let total = 0;

  const joMatch = cleaned.match(/(\d+(?:\.\d+)?)조/);
  if (joMatch) total += parseFloat(joMatch[1]) * 1_000_000_000_000;

  const eokMatch = cleaned.match(/(\d+(?:\.\d+)?)억/);
  if (eokMatch) total += parseFloat(eokMatch[1]) * 100_000_000;

  const manMatch = cleaned.match(/(\d+(?:\.\d+)?)만/);
  if (manMatch) total += parseFloat(manMatch[1]) * 10_000;

  // 순수 숫자만 있는 경우
  if (total === 0) {
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }

  return total || null;
}

/**
 * 숫자 → 한글 금액 포맷 (예: 1200000000000 → "1.2조")
 */
export function formatKoreanAmount(num: number | null): string {
  if (num === null || num === undefined) return '-';
  if (num >= 1_000_000_000_000) {
    return `${(num / 1_000_000_000_000).toFixed(1)}조`;
  }
  if (num >= 100_000_000) {
    return `${(num / 100_000_000).toFixed(0)}억`;
  }
  if (num >= 10_000) {
    return `${(num / 10_000).toFixed(0)}만`;
  }
  return num.toLocaleString();
}

/**
 * YYYYMMDD → YYYY-MM-DD 변환
 */
export function formatDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * 오늘 날짜 (YYYYMMDD)
 */
export function getTodayYYYYMMDD(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * N일 전 날짜 (YYYYMMDD)
 */
export function getDateNDaysAgo(n: number): string {
  const date = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

// ============================================
// OpenDART API 타입
// ============================================
export interface DartListResponse {
  status: string;
  message: string;
  page_no: number;
  page_count: number;
  total_count: number;
  total_page: number;
  list: DartListItem[];
}

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
