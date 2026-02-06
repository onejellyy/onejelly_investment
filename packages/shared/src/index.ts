/**
 * @onejellyinvest/shared
 *
 * 한국 주식 정보 앱 공유 모듈
 * - 중립적 정보 제공 (추천/분석 표현 금지)
 * - 코드/룰 기반 계산
 */

// Types
export * from './types';
export type {
  ApiError,
  HealthResponse,
  BatchResult,
  PaginatedApiResponse,
  CursorPaginatedResponse,
} from './types/api';

// Scoring (밸류에이션 점수)
export * from './scoring';

// Utils
export {
  buildDartUrl,
  isCorrection,
  extractOriginRceptNo,
  truncate,
  simpleHash,
  sleep,
  retry,
  parseKoreanNumber,
  formatKoreanNumber,
} from './utils';

// Data (Peer Group 매핑 등)
export * from './data';
