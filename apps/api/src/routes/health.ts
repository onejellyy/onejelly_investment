/**
 * 헬스체크 API 라우트
 */

import { Hono } from 'hono';
import type { Env } from '../types';

export const healthRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/health
 * 서비스 상태 확인
 */
healthRoutes.get('/', async (c) => {
  const db = c.env.DB;

  const checks: Record<string, 'ok' | 'error'> = {
    api: 'ok',
    database: 'error',
  };

  try {
    // D1 연결 확인
    await db.prepare('SELECT 1').first();
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');

  return c.json(
    {
      status: allOk ? 'ok' : 'degraded',
      version: '1.0.0',
      environment: c.env.ENVIRONMENT || 'development',
      checks,
      timestamp: new Date().toISOString(),
    },
    allOk ? 200 : 503
  );
});

/**
 * GET /api/health/batch
 * 배치 작업 상태 확인
 */
healthRoutes.get('/batch', async (c) => {
  const db = c.env.DB;

  try {
    const recentBatches = await db
      .prepare(
        `SELECT batch_type, status, started_at, finished_at, items_processed, items_failed
         FROM batch_log
         ORDER BY started_at DESC
         LIMIT 10`
      )
      .all<{
        batch_type: string;
        status: string;
        started_at: string;
        finished_at: string | null;
        items_processed: number;
        items_failed: number;
      }>();

    // 마지막 성공 시간
    const lastSuccess = await db
      .prepare(
        `SELECT batch_type, MAX(finished_at) as last_success
         FROM batch_log
         WHERE status = 'success'
         GROUP BY batch_type`
      )
      .all<{ batch_type: string; last_success: string }>();

    return c.json({
      success: true,
      data: {
        recent: recentBatches.results || [],
        last_success: lastSuccess.results || [],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Batch health error:', err);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch batch status',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

/**
 * GET /api/health/stats
 * 데이터 통계
 */
healthRoutes.get('/stats', async (c) => {
  const db = c.env.DB;

  try {
    const stats = await db.batch([
      db.prepare('SELECT COUNT(*) as count FROM disclosure'),
      db.prepare('SELECT COUNT(*) as count FROM news_article'),
      db.prepare('SELECT COUNT(*) as count FROM valuation_snapshot'),
      db.prepare('SELECT COUNT(*) as count FROM corp_master WHERE is_active = 1'),
    ]);

    return c.json({
      success: true,
      data: {
        disclosures: (stats[0].results?.[0] as { count: number })?.count || 0,
        news_articles: (stats[1].results?.[0] as { count: number })?.count || 0,
        valuation_snapshots: (stats[2].results?.[0] as { count: number })?.count || 0,
        active_corps: (stats[3].results?.[0] as { count: number })?.count || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Stats error:', err);
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

/**
 * GET /api/health/krx
 * KRX OpenAPI 접근 가능 여부 확인 (키 유출 없이 상태만 반환)
 *
 * NOTE:
 * - 실제 운영에서 시세 배치가 비는 가장 흔한 원인이 KRX OpenAPI 401이다.
 * - Cloudflare Worker 환경에서 외부 네트워크/인증 문제가 있을 수 있어 별도 진단 엔드포인트를 둔다.
 */
healthRoutes.get('/krx', async (c) => {
  const date = c.req.query('date') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const basDd = date.replace(/-/g, '');

  const endpoints = [
    {
      name: 'KOSPI',
      url: (c.env.KRX_KOSPI_API_URL || 'https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd?basDd={date}').replace(
        '{date}',
        basDd
      ),
    },
    {
      name: 'KOSDAQ',
      url: (c.env.KRX_KOSDAQ_API_URL || 'https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd?basDd={date}').replace(
        '{date}',
        basDd
      ),
    },
  ];

  async function probe(url: string, key?: string) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OneJellyInvest/1.0',
        'Accept': 'application/json',
        ...(key ? { AUTH_KEY: key } : {}),
      },
    });

    let body: unknown = null;
    try {
      body = await response.clone().json();
    } catch {
      try {
        body = await response.text();
      } catch {
        body = null;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      // 에러 메시지만 반환 (키/요청 상세는 절대 반환하지 않음)
      respCode:
        typeof body === 'object' && body && 'respCode' in body
          ? (body as { respCode?: unknown }).respCode
          : null,
      respMsg:
        typeof body === 'object' && body && 'respMsg' in body
          ? (body as { respMsg?: unknown }).respMsg
          : typeof body === 'string'
            ? body.slice(0, 120)
            : null,
    };
  }

  try {
    const key = c.env.KRX_API_KEY;
    const results = await Promise.all(endpoints.map(async (e) => ({ name: e.name, url: e.url, ...(await probe(e.url, key)) })));

    return c.json({
      success: true,
      data: {
        date,
        results,
        source: c.env.KRX_SOURCE || null,
        has_key: Boolean(key),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});
