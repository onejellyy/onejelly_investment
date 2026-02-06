/**
 * 밸류에이션 API 라우트
 *
 * 읽기 전용, 밸류에이션 지표 조회
 * 점수는 "상태 지표"이며 투자 판단 아님
 * 중립 문구만 사용
 */

import { Hono } from 'hono';
import type { Env, ValuationSnapshot, BandLabel } from '../types';
import { getPercentileLabel, getOverallLabel } from '../types';

export const valuationRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/valuations
 * 밸류에이션 스냅샷 목록
 */
valuationRoutes.get('/', async (c) => {
  const db = c.env.DB;

  const peerCode = c.req.query('peer_code');
  const bandLabel = c.req.query('band_label') as BandLabel | undefined;
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    // 최신 날짜의 스냅샷만 조회
    const latestDate = await db
      .prepare('SELECT snap_date FROM valuation_snapshot ORDER BY snap_date DESC LIMIT 1')
      .first<{ snap_date: string }>();

    if (!latestDate) {
      return c.json({
        success: true,
        data: { items: [], total: 0, snap_date: null },
        timestamp: new Date().toISOString(),
      });
    }

    let query = `SELECT v.*, c.corp_name, c.stock_code, c.market, p.peer_name
                 FROM valuation_snapshot v
                 JOIN corp_master c ON v.corp_code = c.corp_code
                 LEFT JOIN peer_group p ON v.peer_code = p.peer_code
                 WHERE v.snap_date = ?`;
    const bindings: (string | number)[] = [latestDate.snap_date];

    if (peerCode) {
      query += ` AND v.peer_code = ?`;
      bindings.push(peerCode);
    }

    if (bandLabel) {
      query += ` AND v.band_label = ?`;
      bindings.push(bandLabel);
    }

    query += ` ORDER BY v.valuation_score DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const result = await db.prepare(query).bind(...bindings).all<ValuationSnapshotWithCorp>();

    // 중립 문구로 변환
    const items = (result.results || []).map((row) => formatValuationView(row));

    return c.json({
      success: true,
      data: {
        items,
        snap_date: latestDate.snap_date,
        total: items.length,
      },
      disclaimer: '본 정보는 투자 조언이 아닙니다. 점수는 업종 대비 상대적 위치를 나타내는 지표입니다.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Valuation list error:', err);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch valuations',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

/**
 * GET /api/valuations/:corp_code
 * 특정 기업 밸류에이션 상세
 */
valuationRoutes.get('/:corp_code', async (c) => {
  const db = c.env.DB;
  const corpCode = c.req.param('corp_code');

  try {
    const result = await db
      .prepare(
        `SELECT v.*, c.corp_name, c.stock_code, c.market, c.industry_name, p.peer_name
         FROM valuation_snapshot v
         JOIN corp_master c ON v.corp_code = c.corp_code
         LEFT JOIN peer_group p ON v.peer_code = p.peer_code
         WHERE v.corp_code = ?
         ORDER BY v.snap_date DESC
         LIMIT 1`
      )
      .bind(corpCode)
      .first<ValuationSnapshotWithCorp>();

    if (!result) {
      return c.json(
        {
          success: false,
          error: 'Valuation not found',
          timestamp: new Date().toISOString(),
        },
        404
      );
    }

    const view = formatValuationView(result);

    // 히스토리 조회 (최근 30일)
    const history = await db
      .prepare(
        `SELECT snap_date, valuation_score, band_label
         FROM valuation_snapshot
         WHERE corp_code = ?
         ORDER BY snap_date DESC
         LIMIT 30`
      )
      .bind(corpCode)
      .all<{ snap_date: string; valuation_score: number; band_label: string }>();

    return c.json({
      success: true,
      data: {
        current: view,
        history: history.results || [],
      },
      disclaimer: '본 정보는 투자 조언이 아닙니다. 점수는 업종 대비 상대적 위치를 나타내는 지표입니다.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Valuation detail error:', err);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch valuation',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

/**
 * GET /api/valuations/peers/:peer_code
 * Peer Group 내 밸류에이션 비교
 */
valuationRoutes.get('/peers/:peer_code', async (c) => {
  const db = c.env.DB;
  const peerCode = c.req.param('peer_code');

  try {
    // 최신 날짜
    const latestDate = await db
      .prepare(
        `SELECT snap_date FROM valuation_snapshot
         WHERE peer_code = ?
         ORDER BY snap_date DESC LIMIT 1`
      )
      .bind(peerCode)
      .first<{ snap_date: string }>();

    if (!latestDate) {
      return c.json({
        success: true,
        data: { items: [], peer_code: peerCode, peer_name: null },
        timestamp: new Date().toISOString(),
      });
    }

    const result = await db
      .prepare(
        `SELECT v.*, c.corp_name, c.stock_code, c.market, p.peer_name
         FROM valuation_snapshot v
         JOIN corp_master c ON v.corp_code = c.corp_code
         JOIN peer_group p ON v.peer_code = p.peer_code
         WHERE v.peer_code = ? AND v.snap_date = ?
         ORDER BY v.valuation_score DESC`
      )
      .bind(peerCode, latestDate.snap_date)
      .all<ValuationSnapshotWithCorp>();

    const items = (result.results || []).map((row) => formatValuationView(row));
    const peerName = items[0]?.peer_name || null;

    return c.json({
      success: true,
      data: {
        items,
        peer_code: peerCode,
        peer_name: peerName,
        snap_date: latestDate.snap_date,
        total: items.length,
      },
      disclaimer: '본 정보는 투자 조언이 아닙니다. 점수는 업종 대비 상대적 위치를 나타내는 지표입니다.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Peer valuation error:', err);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch peer valuations',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

interface ValuationSnapshotWithCorp extends ValuationSnapshot {
  corp_name: string;
  stock_code: string;
  market: string;
  industry_name?: string;
  peer_name: string | null;
}

interface ValuationView {
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
    per_ttm: { value: number | null; label: string };
    pbr: { value: number | null; label: string };
    psr_ttm: { value: number | null; label: string };
    roe_ttm: { value: number | null; label: string };
    opm_ttm: { value: number | null; label: string };
    debt_ratio: { value: number | null; label: string };
  };
  valuation_score: number | null;
  overall_label: string; // "업종 대비 지표 양호" 등
}

function formatValuationView(row: ValuationSnapshotWithCorp): ValuationView {
  return {
    corp_code: row.corp_code,
    corp_name: row.corp_name,
    stock_code: row.stock_code,
    market: row.market,
    industry_name: row.industry_name || null,
    peer_code: row.peer_code,
    peer_name: row.peer_name,
    snap_date: row.snap_date,
    price: row.price,
    market_cap: row.market_cap,
    metrics: {
      per_ttm: {
        value: row.per_ttm,
        label: getPercentileLabel(row.per_percentile),
      },
      pbr: {
        value: row.pbr,
        label: getPercentileLabel(row.pbr_percentile),
      },
      psr_ttm: {
        value: row.psr_ttm,
        label: getPercentileLabel(row.psr_percentile),
      },
      roe_ttm: {
        value: row.roe_ttm,
        label: getPercentileLabel(row.roe_percentile),
      },
      opm_ttm: {
        value: row.opm_ttm,
        label: getPercentileLabel(row.opm_percentile),
      },
      debt_ratio: {
        value: row.debt_ratio,
        label: '참고용', // 부채비율은 퍼센타일 없음
      },
    },
    valuation_score: row.valuation_score,
    overall_label: row.band_label ? getOverallLabel(row.band_label) : '데이터 없음',
  };
}
