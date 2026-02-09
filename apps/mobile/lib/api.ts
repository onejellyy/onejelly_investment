import type { HealthResponse, BandLabel } from '@onejellyinvest/shared';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787';

export interface FeedItem {
  type: 'disclosure' | 'news';
  id: string;
  title: string;
  source: string;
  category: string | null;
  published_at: string;
  preview_image_url: string | null;
  url: string;
  stock_code: string | null;
  corp_code: string | null;
}

export interface FeedResponse {
  success: boolean;
  data?: {
    items: FeedItem[];
    next_cursor: string | null;
    has_more: boolean;
  };
  error?: string;
}

export interface FeedQuery {
  type?: 'all' | 'disclosure' | 'news';
  category?: string;
  limit?: number;
  cursor?: string;
  stock_code?: string;
}

export interface MetricValue {
  value: number | null;
  label: string;
}

export interface ValuationView {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  market: string;
  industry_name: string | null;
  peer_code: string | null;
  peer_name: string | null;
  snap_date: string;
  price: number | null;
  market_cap: number | null;
  metrics: {
    per_ttm: MetricValue;
    pbr: MetricValue;
    psr_ttm: MetricValue;
    roe_ttm: MetricValue;
    opm_ttm: MetricValue;
    debt_ratio: MetricValue;
  };
  valuation_score: number | null;
  overall_label: string;
}

export interface ValuationListResponse {
  success: boolean;
  data?: {
    items: ValuationView[];
    snap_date: string;
    total: number;
  };
  disclaimer?: string;
  error?: string;
}

export interface ValuationHistoryEntry {
  snap_date: string;
  valuation_score: number;
  band_label: string;
}

export interface ValuationDetailResponse {
  success: boolean;
  data?: {
    current: ValuationView;
    history: ValuationHistoryEntry[];
  };
  disclaimer?: string;
  error?: string;
}

export interface DisclosureListItem {
  rcept_no: string;
  corp_code: string;
  stock_code: string | null;
  corp_name: string;
  disclosed_at: string;
  category: string;
  type: string;
  title: string;
  source_url: string;
  is_correction: number;
}

export interface DisclosureListResponse {
  success: boolean;
  data?: {
    items: DisclosureListItem[];
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
  };
  disclaimer?: string;
  error?: string;
}

export interface ValuationQuery {
  band_label?: BandLabel;
  peer_code?: string;
  limit?: number;
  offset?: number;
}

export interface DisclosureQuery {
  category?: string;
  stock_code?: string;
  corp_code?: string;
  limit?: number;
  offset?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getFeed(query: FeedQuery = {}): Promise<FeedResponse> {
    const params = new URLSearchParams();

    if (query.type && query.type !== 'all') {
      params.set('type', query.type);
    }
    if (query.category) {
      params.set('category', query.category);
    }
    if (query.limit) {
      params.set('limit', String(query.limit));
    }
    if (query.cursor) {
      params.set('cursor', query.cursor);
    }
    if (query.stock_code) {
      params.set('stock_code', query.stock_code);
    }

    const queryString = params.toString();
    const path = queryString ? `/api/feed?${queryString}` : '/api/feed';

    return this.fetch<FeedResponse>(path);
  }

  async getValuations(query: ValuationQuery = {}): Promise<ValuationListResponse> {
    const params = new URLSearchParams();
    if (query.band_label) params.set('band_label', query.band_label);
    if (query.peer_code) params.set('peer_code', query.peer_code);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset != null) params.set('offset', String(query.offset));

    const qs = params.toString();
    return this.fetch<ValuationListResponse>(
      qs ? `/api/valuations?${qs}` : '/api/valuations',
    );
  }

  async getValuationDetail(corpCode: string): Promise<ValuationDetailResponse> {
    return this.fetch<ValuationDetailResponse>(`/api/valuations/${corpCode}`);
  }

  async getDisclosures(query: DisclosureQuery = {}): Promise<DisclosureListResponse> {
    const params = new URLSearchParams();
    if (query.category) params.set('category', query.category);
    if (query.stock_code) params.set('stock_code', query.stock_code);
    if (query.corp_code) params.set('corp_code', query.corp_code);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset != null) params.set('offset', String(query.offset));

    const qs = params.toString();
    return this.fetch<DisclosureListResponse>(
      qs ? `/api/disclosures?${qs}` : '/api/disclosures',
    );
  }

  async getHealth(): Promise<HealthResponse> {
    return this.fetch<HealthResponse>('/api/health');
  }
}

export const api = new ApiClient(API_BASE_URL);
