/**
 * 피드 API 라우트
 *
 * 통합 피드: 공시 + 기사
 * 읽기 전용, 페이지네이션 지원
 */

import { Hono } from 'hono';
import type { Env } from '../types';

export const feedRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/feed
 * 통합 피드 조회 (공시 + 기사)
 *
 * Query Params:
 * - type: 'disclosure' | 'news' | 'all' (default: 'all')
 * - category: 실적, 수주계약, 자본, 주주가치, 지배구조, 리스크, 기타
 * - stock_code: 종목코드 필터
 * - limit: 페이지 크기 (default: 20, max: 100)
 * - cursor: 페이지네이션 커서
 */
feedRoutes.get('/', async (c) => {
  const db = c.env.DB;

  const type = c.req.query('type') || 'all';
  const category = c.req.query('category');
  const stockCode = c.req.query('stock_code');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const cursor = c.req.query('cursor');

  try {
    const items: FeedItem[] = [];
    let nextCursor: string | null = null;

    if (type === 'all' || type === 'disclosure') {
      const disclosures = await fetchDisclosures(db, { category, stockCode, limit, cursor });
      items.push(
        ...disclosures.items.map((d) => ({
          type: 'disclosure' as const,
          id: d.rcept_no,
          title: d.title,
          source: d.corp_name,
          category: d.category,
          published_at: d.disclosed_at,
          summary: null,
          url: d.source_url,
          stock_code: d.stock_code,
          corp_code: d.corp_code,
        }))
      );
      nextCursor = disclosures.nextCursor;
    }

    if (type === 'all' || type === 'news') {
      const news = await fetchNews(db, { limit, cursor });
      items.push(
        ...news.items.map((n) => ({
          type: 'news' as const,
          id: n.url,
          title: n.title,
          source: n.source,
          category: null,
          published_at: n.published_at,
          summary: n.one_liner,
          url: n.url,
          stock_code: null,
          corp_code: null,
        }))
      );
      if (!nextCursor) nextCursor = news.nextCursor;
    }

    // 시간순 정렬
    items.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    // limit 적용
    const limitedItems = items.slice(0, limit);

    return c.json({
      success: true,
      data: {
        items: limitedItems,
        next_cursor: nextCursor,
        has_more: items.length > limit,
      },
      disclaimer: '본 정보는 투자 조언이 아니며, 투자 결정은 본인 책임입니다.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Feed error:', err);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch feed',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

interface FeedItem {
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

interface DisclosureRow {
  rcept_no: string;
  corp_code: string;
  stock_code: string | null;
  corp_name: string;
  disclosed_at: string;
  category: string;
  title: string;
  source_url: string;
}

interface NewsRow {
  url: string;
  source: string;
  title: string;
  published_at: string;
  one_liner: string | null;
}

async function fetchDisclosures(
  db: D1Database,
  options: { category?: string; stockCode?: string; limit: number; cursor?: string }
): Promise<{ items: DisclosureRow[]; nextCursor: string | null }> {
  let query = `SELECT rcept_no, corp_code, stock_code, corp_name, disclosed_at, category, title, source_url
               FROM disclosure
               WHERE 1=1`;
  const bindings: (string | number)[] = [];

  if (options.category) {
    query += ` AND category = ?`;
    bindings.push(options.category);
  }

  if (options.stockCode) {
    query += ` AND stock_code = ?`;
    bindings.push(options.stockCode);
  }

  if (options.cursor) {
    query += ` AND disclosed_at < ?`;
    bindings.push(options.cursor);
  }

  query += ` ORDER BY disclosed_at DESC LIMIT ?`;
  bindings.push(options.limit + 1);

  const stmt = db.prepare(query);
  const result = await stmt.bind(...bindings).all<DisclosureRow>();

  const items = result.results || [];
  const hasMore = items.length > options.limit;
  const limitedItems = items.slice(0, options.limit);

  return {
    items: limitedItems,
    nextCursor: hasMore && limitedItems.length > 0 ? limitedItems[limitedItems.length - 1].disclosed_at : null,
  };
}

async function fetchNews(
  db: D1Database,
  options: { limit: number; cursor?: string }
): Promise<{ items: NewsRow[]; nextCursor: string | null }> {
  let query = `SELECT url, source, title, published_at, one_liner
               FROM news_article
               WHERE 1=1`;
  const bindings: (string | number)[] = [];

  if (options.cursor) {
    query += ` AND published_at < ?`;
    bindings.push(options.cursor);
  }

  query += ` ORDER BY published_at DESC LIMIT ?`;
  bindings.push(options.limit + 1);

  const stmt = db.prepare(query);
  const result = await stmt.bind(...bindings).all<NewsRow>();

  const items = result.results || [];
  const hasMore = items.length > options.limit;
  const limitedItems = items.slice(0, options.limit);

  return {
    items: limitedItems,
    nextCursor: hasMore && limitedItems.length > 0 ? limitedItems[limitedItems.length - 1].published_at : null,
  };
}
