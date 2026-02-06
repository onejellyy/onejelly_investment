// ============================================
// API Error & Response Types
// 중립적 정보 제공 (추천/분석 표현 금지)
// ============================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  disclaimer?: string; // 법적 면책 문구
  timestamp: string;
}

// Health check
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  environment: string;
  timestamp: string;
  checks: {
    api: 'ok' | 'error';
    database: 'ok' | 'error';
  };
}

// Batch job responses
export interface BatchResult {
  status: 'success' | 'partial' | 'error';
  batch_type: 'disclosure' | 'news' | 'valuation' | 'financial';
  items_processed: number;
  items_failed: number;
  errors: string[];
  duration_ms: number;
  started_at: string;
  finished_at: string;
}

// Paginated response
export interface PaginatedApiResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
  };
  disclaimer?: string;
  timestamp: string;
}

// Cursor-based pagination
export interface CursorPaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    next_cursor: string | null;
    has_more: boolean;
  };
  disclaimer?: string;
  timestamp: string;
}
