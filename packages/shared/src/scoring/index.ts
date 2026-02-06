/**
 * 밸류에이션 점수 계산
 *
 * - 점수는 "상태 지표"이며 투자 판단 아님
 * - 코드/룰 기반으로만 계산 (AI 사용 안 함)
 * - 중립 문구만 사용
 */

import type { DisclosureCategory, BandLabel } from '../types';
import { BAND_LABELS, getBandLabel } from '../types';

// ============================================
// 밸류에이션 점수 가중치
// ============================================

export const VALUATION_WEIGHTS = {
  per: 0.25, // PER (역방향: 낮을수록 좋음)
  pbr: 0.2, // PBR (역방향)
  psr: 0.15, // PSR (역방향)
  roe: 0.2, // ROE (정방향: 높을수록 좋음)
  opm: 0.2, // OPM (정방향)
} as const;

// ============================================
// 퍼센타일 계산
// ============================================

export interface PercentileInput {
  per_ttm: number | null;
  pbr: number | null;
  psr_ttm: number | null;
  roe_ttm: number | null;
  opm_ttm: number | null;
}

export interface PercentileResult {
  per_percentile: number | null;
  pbr_percentile: number | null;
  psr_percentile: number | null;
  roe_percentile: number | null;
  opm_percentile: number | null;
}

/**
 * 배열에서 특정 값의 퍼센타일 계산
 * @param value 대상 값
 * @param sortedValues 정렬된 값 배열
 * @param inverted true면 역방향 (낮을수록 높은 퍼센타일)
 */
export function calculatePercentile(
  value: number,
  sortedValues: number[],
  inverted: boolean = false
): number {
  if (sortedValues.length === 0) return 50;

  // 순위 찾기
  let rank = 0;
  for (let i = 0; i < sortedValues.length; i++) {
    if (sortedValues[i] <= value) rank = i + 1;
    else break;
  }

  let percentile = (rank / sortedValues.length) * 100;

  // 역방향이면 반전
  if (inverted) {
    percentile = 100 - percentile;
  }

  return Math.round(percentile * 10) / 10;
}

// ============================================
// 밸류에이션 점수 계산
// ============================================

/**
 * 퍼센타일 기반 valuation_score 계산
 */
export function calculateValuationScore(percentiles: PercentileResult): number {
  let totalWeight = 0;
  let weightedSum = 0;

  // PER (이미 역방향 변환됨)
  if (percentiles.per_percentile !== null) {
    weightedSum += percentiles.per_percentile * VALUATION_WEIGHTS.per;
    totalWeight += VALUATION_WEIGHTS.per;
  }

  // PBR (이미 역방향 변환됨)
  if (percentiles.pbr_percentile !== null) {
    weightedSum += percentiles.pbr_percentile * VALUATION_WEIGHTS.pbr;
    totalWeight += VALUATION_WEIGHTS.pbr;
  }

  // PSR (이미 역방향 변환됨)
  if (percentiles.psr_percentile !== null) {
    weightedSum += percentiles.psr_percentile * VALUATION_WEIGHTS.psr;
    totalWeight += VALUATION_WEIGHTS.psr;
  }

  // ROE (정방향)
  if (percentiles.roe_percentile !== null) {
    weightedSum += percentiles.roe_percentile * VALUATION_WEIGHTS.roe;
    totalWeight += VALUATION_WEIGHTS.roe;
  }

  // OPM (정방향)
  if (percentiles.opm_percentile !== null) {
    weightedSum += percentiles.opm_percentile * VALUATION_WEIGHTS.opm;
    totalWeight += VALUATION_WEIGHTS.opm;
  }

  if (totalWeight === 0) return 50; // 데이터 없으면 중립

  return Math.round(weightedSum / totalWeight);
}

// ============================================
// 공시 카테고리 분류 (룰 기반)
// ============================================

export const CATEGORY_RULES: Record<Exclude<DisclosureCategory, '기타'>, string[]> = {
  '실적': [
    '사업보고서',
    '분기보고서',
    '반기보고서',
    '잠정실적',
    '매출액',
    '영업이익',
    '실적',
    '연결재무',
    '재무제표',
  ],
  '수주계약': ['수주', '계약', '공급계약', '납품', '공급', '용역계약', '라이선스'],
  '자본': ['유상증자', '무상증자', '증자', '감자', '전환사채', 'CB', 'BW', '신주인수권', '주식매수선택권', '신주'],
  '주주가치': ['배당', '현금배당', '자사주', '자기주식', '주식소각', '주주환원'],
  '지배구조': ['임원', '이사회', '주총', '주주총회', '최대주주', '대표이사', '감사', '사외이사'],
  '리스크': ['소송', '횡령', '배임', '감사의견', '비적정', '상장폐지', '관리종목', '회생', '파산', '부도', '거래정지'],
};

/**
 * 공시 제목 → 카테고리 분류
 */
export function classifyCategory(title: string): DisclosureCategory {
  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    if (keywords.some((kw) => title.includes(kw))) {
      return category as DisclosureCategory;
    }
  }
  return '기타';
}

// ============================================
// 재무 수치 추출 (정규식 기반)
// ============================================

export interface ExtractedNumbers {
  revenue?: number;
  revenue_yoy?: number;
  op_profit?: number;
  op_profit_yoy?: number;
  net_profit?: number;
  net_profit_yoy?: number;
  contract_amount?: number;
  contract_ratio?: number;
  dividend_per_share?: number;
  dividend_yield?: number;
  capital_amount?: number;
}

/**
 * 한글 금액 → 숫자 변환
 */
function parseKoreanAmount(numStr: string, unit: string): number {
  const num = parseInt(numStr.replace(/,/g, ''));
  switch (unit) {
    case '조':
      return num * 1_000_000_000_000;
    case '억':
      return num * 100_000_000;
    case '만':
      return num * 10_000;
    default:
      return num;
  }
}

/**
 * 텍스트에서 핵심 수치 추출
 */
export function extractNumbers(category: DisclosureCategory, content: string): ExtractedNumbers {
  const numbers: ExtractedNumbers = {};

  switch (category) {
    case '실적': {
      const revenueMatch = content.match(/매출액?\s*[:\s]*([0-9,]+)\s*(조|억)/);
      if (revenueMatch) {
        numbers.revenue = parseKoreanAmount(revenueMatch[1], revenueMatch[2]);
      }

      const opMatch = content.match(/영업이익\s*[:\s]*([0-9,]+)\s*(조|억)/);
      if (opMatch) {
        numbers.op_profit = parseKoreanAmount(opMatch[1], opMatch[2]);
      }

      const yoyMatch = content.match(/전년\s*대비\s*([+-]?\d+\.?\d*)\s*%/);
      if (yoyMatch) {
        numbers.revenue_yoy = parseFloat(yoyMatch[1]);
      }
      break;
    }

    case '수주계약': {
      const contractMatch = content.match(/계약금액?\s*[:\s]*([0-9,]+)\s*(조|억)/);
      if (contractMatch) {
        numbers.contract_amount = parseKoreanAmount(contractMatch[1], contractMatch[2]);
      }

      const ratioMatch = content.match(/매출액?\s*대비\s*([0-9\.]+)\s*%/);
      if (ratioMatch) {
        numbers.contract_ratio = parseFloat(ratioMatch[1]);
      }
      break;
    }

    case '주주가치': {
      const dpsMatch = content.match(/주당\s*배당금?\s*[:\s]*([0-9,]+)\s*원/);
      if (dpsMatch) {
        numbers.dividend_per_share = parseInt(dpsMatch[1].replace(/,/g, ''));
      }

      const yieldMatch = content.match(/배당수익률?\s*[:\s]*([0-9\.]+)\s*%/);
      if (yieldMatch) {
        numbers.dividend_yield = parseFloat(yieldMatch[1]);
      }
      break;
    }

    case '자본': {
      const capitalMatch = content.match(/([0-9,]+)\s*(조|억)\s*원?\s*(증자|발행)/);
      if (capitalMatch) {
        numbers.capital_amount = parseKoreanAmount(capitalMatch[1], capitalMatch[2]);
      }
      break;
    }
  }

  return numbers;
}

// ============================================
// 공시 우선순위 (재무 반영용)
// ============================================

export const SOURCE_PRIORITY: Record<string, number> = {
  '사업보고서': 3,
  '반기보고서': 2,
  '분기보고서': 2,
  '잠정실적': 1,
};

/**
 * 공시 제목에서 우선순위 추출
 */
export function getSourcePriority(title: string): number {
  for (const [keyword, priority] of Object.entries(SOURCE_PRIORITY)) {
    if (title.includes(keyword)) {
      return priority;
    }
  }
  return 0;
}

// ============================================
// 밴드 라벨 관련 (re-export)
// ============================================

export { BAND_LABELS, getBandLabel };
export type { BandLabel };
