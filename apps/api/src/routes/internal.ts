/**
 * 내부 API 라우트 (Internal API Routes)
 *
 * Firebase Functions 등 내부 서비스에서 호출하는 엔드포인트
 * X-Internal-Secret 헤더로 인증
 */

import { Hono } from 'hono';
import type { Env } from '../types';

export const internalRoutes = new Hono<{ Bindings: Env }>();

// 간단한 시크릿 검증 (환경변수로 설정)
const INTERNAL_SECRET = 'onejellyinvest-internal-2026';

/**
 * 시크릿 검증 미들웨어
 */
internalRoutes.use('*', async (c, next) => {
  const secret = c.req.header('X-Internal-Secret');

  // 환경변수에서 시크릿 가져오기 (없으면 하드코딩된 값 사용)
  const expectedSecret = c.env.INTERNAL_API_SECRET || INTERNAL_SECRET;

  if (secret !== expectedSecret) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  await next();
});

/**
 * POST /api/internal/disclosures/bulk
 * Firebase Functions에서 수집한 공시 배치 저장
 */
internalRoutes.post('/disclosures/bulk', async (c) => {
  const db = c.env.DB;

  try {
    const body = await c.req.json<{
      disclosures: Array<{
        rcept_no: string;
        corp_code: string;
        stock_code: string | null;
        corp_name: string;
        disclosed_at: string;
        category: string;
        type: string;
        title: string;
        key_json: Record<string, unknown> | null;
        source_url: string;
        is_correction: boolean;
      }>;
    }>();

    if (!body.disclosures || !Array.isArray(body.disclosures)) {
      return c.json({ success: false, error: 'Invalid request body' }, 400);
    }

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const d of body.disclosures) {
      try {
        // 중복 체크
        const existing = await db
          .prepare('SELECT 1 FROM disclosure WHERE rcept_no = ? LIMIT 1')
          .bind(d.rcept_no)
          .first();

        if (existing) {
          skipped++;
          continue;
        }

        // corp_master에 회사 정보 upsert (FK 제약 해결)
        if (d.stock_code) {
          await db
            .prepare(
              `INSERT OR IGNORE INTO corp_master (corp_code, stock_code, corp_name, updated_at)
               VALUES (?, ?, ?, datetime('now'))`
            )
            .bind(d.corp_code, d.stock_code, d.corp_name)
            .run();
        }

        // 공시 저장
        await db
          .prepare(
            `INSERT INTO disclosure
             (rcept_no, corp_code, stock_code, corp_name, disclosed_at, category, type, title, key_json, source_url, is_correction, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          )
          .bind(
            d.rcept_no,
            d.corp_code,
            d.stock_code,
            d.corp_name,
            d.disclosed_at,
            d.category,
            d.type,
            d.title,
            d.key_json ? JSON.stringify(d.key_json) : null,
            d.source_url,
            d.is_correction ? 1 : 0
          )
          .run();

        inserted++;
      } catch (err) {
        errors.push(`${d.rcept_no}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return c.json({
      success: true,
      inserted,
      skipped,
      total: body.disclosures.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Bulk insert error:', err);
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal error',
      },
      500
    );
  }
});

/**
 * GET /api/internal/health
 * 내부 API 헬스 체크
 */
internalRoutes.get('/health', async (c) => {
  return c.json({
    success: true,
    service: 'internal-api',
    timestamp: new Date().toISOString(),
  });
});
