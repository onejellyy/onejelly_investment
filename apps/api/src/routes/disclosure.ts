/**
 * 공시 API 라우트
 *
 * 읽기 전용, 공시 목록 및 상세 조회
 */

import { Hono } from 'hono';
import type { Env, DisclosureCategory } from '../types';

export const disclosureRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/disclosures
 * 공시 목록 조회
 */
disclosureRoutes.get('/', async (c) => {
  const db = c.env.DB;

  const category = c.req.query('category') as DisclosureCategory | undefined;
  const stockCode = c.req.query('stock_code');
  const corpCode = c.req.query('corp_code');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    let query = `SELECT rcept_no, corp_code, stock_code, corp_name, disclosed_at, category, type, title, source_url, is_correction
                 FROM disclosure
                 WHERE 1=1`;
    const bindings: (string | number)[] = [];

    if (category) {
      query += ` AND category = ?`;
      bindings.push(category);
    }

    if (stockCode) {
      query += ` AND stock_code = ?`;
      bindings.push(stockCode);
    }

    if (corpCode) {
      query += ` AND corp_code = ?`;
      bindings.push(corpCode);
    }

    query += ` ORDER BY disclosed_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const stmt = db.prepare(query);
    const result = await stmt.bind(...bindings).all<DisclosureListItem>();

    // 전체 개수 조회
    let countQuery = `SELECT COUNT(*) as total FROM disclosure WHERE 1=1`;
    const countBindings: string[] = [];

    if (category) {
      countQuery += ` AND category = ?`;
      countBindings.push(category);
    }
    if (stockCode) {
      countQuery += ` AND stock_code = ?`;
      countBindings.push(stockCode);
    }
    if (corpCode) {
      countQuery += ` AND corp_code = ?`;
      countBindings.push(corpCode);
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
    console.error('Disclosure list error:', err);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch disclosures',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

/**
 * GET /api/disclosures/:rcept_no
 * 공시 상세 조회
 */
disclosureRoutes.get('/:rcept_no', async (c) => {
  const db = c.env.DB;
  const rceptNo = c.req.param('rcept_no');

  try {
    const disclosure = await db
      .prepare(
        `SELECT rcept_no, corp_code, stock_code, corp_name, disclosed_at, category, type, title, key_json, source_url, is_correction, created_at
         FROM disclosure
         WHERE rcept_no = ?`
      )
      .bind(rceptNo)
      .first<DisclosureDetail>();

    if (!disclosure) {
      return c.json(
        {
          success: false,
          error: 'Disclosure not found',
          timestamp: new Date().toISOString(),
        },
        404
      );
    }

    // key_json 파싱
    const keyNumbers = disclosure.key_json ? JSON.parse(disclosure.key_json) : null;

    return c.json({
      success: true,
      data: {
        ...disclosure,
        key_numbers: keyNumbers,
      },
      disclaimer: '본 정보는 투자 조언이 아니며, 투자 결정은 본인 책임입니다.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Disclosure detail error:', err);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch disclosure',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

/**
 * GET /api/disclosures/categories
 * 카테고리별 통계
 */
disclosureRoutes.get('/stats/categories', async (c) => {
  const db = c.env.DB;

  try {
    const result = await db
      .prepare(
        `SELECT category, COUNT(*) as count
         FROM disclosure
         WHERE disclosed_at >= date('now', '-7 days')
         GROUP BY category
         ORDER BY count DESC`
      )
      .all<{ category: string; count: number }>();

    return c.json({
      success: true,
      data: result.results || [],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Category stats error:', err);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch stats',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

interface DisclosureListItem {
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

interface DisclosureDetail extends DisclosureListItem {
  key_json: string | null;
  created_at: string;
}
