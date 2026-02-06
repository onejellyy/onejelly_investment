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
