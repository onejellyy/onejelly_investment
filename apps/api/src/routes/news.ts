/**
 * 뉴스 API 라우트
 *
 * 읽기 전용, 뉴스 기사 목록 조회
 */

import { Hono } from 'hono';
import type { Env } from '../types';

export const newsRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/news
 * 뉴스 기사 목록
 */
newsRoutes.get('/', async (c) => {
  const db = c.env.DB;

  const source = c.req.query('source');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    let query = `SELECT url, source, title, published_at, preview_image_url, category, created_at
                 FROM news_article
                 WHERE category = 'economy'`;
    const bindings: (string | number)[] = [];

    if (source) {
      query += ` AND source = ?`;
      bindings.push(source);
    }

    query += ` ORDER BY published_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const result = await db.prepare(query).bind(...bindings).all<NewsArticleRow>();

    // 전체 개수
    let countQuery = `SELECT COUNT(*) as total FROM news_article WHERE category = 'economy'`;
    const countBindings: string[] = [];

    if (source) {
      countQuery += ` AND source = ?`;
      countBindings.push(source);
    }

    const countResult = await db.prepare(countQuery).bind(...countBindings).first<{ total: number }>();
    const total = countResult?.total || 0;

    return c.json({
      success: true,
      data: {
        items: result.results || [],
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        has_more: offset + limit < total,
      },
      disclaimer: '본 정보는 투자 조언이 아니며, 투자 결정은 본인 책임입니다.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('News list error:', err);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch news',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

/**
 * GET /api/news/sources
 * 뉴스 소스별 통계
 */
newsRoutes.get('/sources', async (c) => {
  const db = c.env.DB;

  try {
    const result = await db
      .prepare(
        `SELECT source, COUNT(*) as count
         FROM news_article
         WHERE category = 'economy'
           AND published_at >= datetime('now', '-1 day')
         GROUP BY source
         ORDER BY count DESC`
      )
      .all<{ source: string; count: number }>();

    return c.json({
      success: true,
      data: result.results || [],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('News sources error:', err);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch sources',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

interface NewsArticleRow {
  url: string;
  source: string;
  title: string;
  published_at: string;
  preview_image_url: string | null;
  category: string;
  created_at: string;
}
