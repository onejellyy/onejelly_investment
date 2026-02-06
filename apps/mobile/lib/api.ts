import type { HealthResponse } from '@onejellyinvest/shared';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787';

export interface FeedItem {
  type: 'disclosure' | 'news';
  id: string;
  title: string;
  source: string;
  category: string | null;
  published_at: string;
  summary: string | null;
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

  async getHealth(): Promise<HealthResponse> {
    return this.fetch<HealthResponse>('/api/health');
  }
}

export const api = new ApiClient(API_BASE_URL);
