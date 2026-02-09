/**
 * 지표 엔진 (Valuation Engine)
 *
 * 기능:
 * - 일별 종가 수집 (장 마감 후)
 * - 밸류에이션 지표 계산 (PER, PBR, PSR, ROE, OPM, 부채비율)
 * - Peer Group 내 퍼센타일 계산
 * - valuation_score 산출 (0~100)
 * - 중립 밴드 라벨 부여
 *
 * 원칙:
 * - 점수는 "상태 지표"이며 투자 판단 아님
 * - 하루 1회만 실행 (쓰기 최소화)
 * - 모든 계산은 코드/룰 기반 (AI 사용 안 함)
 */

import type { Env, ValuationSnapshot, FinancialTTM, PriceDaily } from '../types';
import { getBandLabel } from '../types';
import { mapIndustryToPeer } from '@onejellyinvest/shared';
import { PriceEngine } from './price';

// ============================================
// 점수 가중치
// ============================================
const SCORE_WEIGHTS = {
  per: 0.25, // PER (역방향: 낮을수록 좋음)
  pbr: 0.2, // PBR (역방향)
  psr: 0.15, // PSR (역방향)
  roe: 0.2, // ROE (정방향: 높을수록 좋음)
  opm: 0.2, // OPM (정방향)
} as const;

// ============================================
// 지표 계산 결과
// ============================================
interface ValuationMetrics {
  per_ttm: number | null;
  pbr: number | null;
  psr_ttm: number | null;
  roe_ttm: number | null;
  opm_ttm: number | null;
  debt_ratio: number | null;
}

interface PercentileResult {
  per_percentile: number | null;
  pbr_percentile: number | null;
  psr_percentile: number | null;
  roe_percentile: number | null;
  opm_percentile: number | null;
}

// ============================================
// 지표 엔진
// ============================================
export class ValuationEngine {
  private db: D1Database;
  private priceEngine: PriceEngine;

  constructor(env: Env) {
    this.db = env.DB;
    this.priceEngine = new PriceEngine(env);
  }

  /**
   * 일일 밸류에이션 스냅샷 생성 (메인 배치)
   */
  async createDailySnapshots(options?: {
    runtimeBudgetMs?: number;
    maxCorps?: number;
  }): Promise<{ processed: number; errors: string[] }> {
    const result = { processed: 0, errors: [] as string[] };
    const startedAtMs = Date.now();
    const runtimeBudgetMs = options?.runtimeBudgetMs ?? 25_000;
    const maxCorps = options?.maxCorps ?? 500;
    const today = new Date().toISOString().slice(0, 10);

    // 이미 오늘 스냅샷 있으면 스킵
    const existing = await this.db
      .prepare('SELECT 1 FROM valuation_snapshot WHERE snap_date = ? LIMIT 1')
      .bind(today)
      .first();

    if (existing) {
      return { processed: 0, errors: ['Today snapshot already exists'] };
    }

    try {
      // 0. 당일 시세 수집 및 저장
      const priceResult = await this.fetchAndSaveDailyPrices(today);
      if (!priceResult.success) {
        console.warn(`[Valuation] Price fetch skipped: ${priceResult.errors.join('; ')}`);
        return { processed: 0, errors: priceResult.errors };
      }

      // 0. Peer Group 매핑 보정 (자동 매핑)
      await this.ensurePeerMappings();

      // 1. 활성 기업 목록 조회
      const corps = await this.db
        .prepare(
          `SELECT c.corp_code, c.stock_code, p.peer_code
           FROM corp_master c
           LEFT JOIN corp_peer_map p ON c.corp_code = p.corp_code
           WHERE c.is_active = 1 AND c.stock_code IS NOT NULL`
        )
        .all<{ corp_code: string; stock_code: string; peer_code: string | null }>();

      if (!corps.results) return result;

      // 2. 각 기업별 스냅샷 생성
      const snapshots: ValuationSnapshot[] = [];

      for (const corp of corps.results.slice(0, maxCorps)) {
        if (Date.now() - startedAtMs > runtimeBudgetMs) {
          result.errors.push('time_budget_exceeded: stopping early to avoid cron timeout');
          break;
        }
        try {
          const snapshot = await this.createSnapshot(corp.corp_code, corp.stock_code, corp.peer_code, today);
          if (snapshot) {
            snapshots.push(snapshot);
          }
        } catch (err) {
          result.errors.push(
            `${corp.corp_code}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // 3. Peer Group별 퍼센타일 계산
      const peerGroups = [...new Set(snapshots.map((s) => s.peer_code).filter(Boolean))];

      for (const peerCode of peerGroups) {
        if (!peerCode) continue;
        const peerSnapshots = snapshots.filter((s) => s.peer_code === peerCode);
        this.calculatePeerPercentiles(peerSnapshots);
      }

      // 4. valuation_score 및 band_label 계산
      for (const snapshot of snapshots) {
        snapshot.valuation_score = this.calculateValuationScore(snapshot);
        snapshot.band_label = getBandLabel(snapshot.valuation_score);
      }

      // 5. 배치 저장
      await this.batchSaveSnapshots(snapshots);
      result.processed = snapshots.length;
    } catch (err) {
      result.errors.push(`Batch error: ${err instanceof Error ? err.message : String(err)}`);
    }

    return result;
  }

  /**
   * KRX 일별 시세 수집 → price_daily 저장
   */
  private async fetchAndSaveDailyPrices(
    snapDate: string
  ): Promise<{ success: boolean; errors: string[] }> {
    try {
      const existing = await this.db
        .prepare('SELECT 1 FROM price_daily WHERE trade_date = ? LIMIT 1')
        .bind(snapDate)
        .first();

      if (existing) {
        console.log(`[Valuation] price_daily already exists for ${snapDate}, skipping fetch.`);
        return { success: true, errors: [] };
      }

      const prices = await this.priceEngine.fetchDailyPrices(snapDate);
      if (prices.length === 0) {
        return { success: false, errors: ['No price data returned from KRX source'] };
      }

      // corp_master에 종목 시딩 (가격 데이터에서 추출)
      await this.seedCorpMasterFromPrices(prices);

      await this.savePriceData(prices);
      return { success: true, errors: [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, errors: [message] };
    }
  }

  /**
   * KRX 가격 데이터에서 corp_master 자동 시딩
   * - stock_code + corp_name이 있는 종목만 upsert
   * - 기존 데이터가 있으면 덮어쓰지 않음 (INSERT OR IGNORE)
   */
  private async seedCorpMasterFromPrices(prices: PriceDaily[]): Promise<void> {
    const corpsToSeed = prices.filter((p) => p.corp_name && p.stock_code);
    if (corpsToSeed.length === 0) return;

    console.log(`[Valuation] Seeding corp_master with ${corpsToSeed.length} stocks from KRX data`);

    const batchSize = 50;
    for (let i = 0; i < corpsToSeed.length; i += batchSize) {
      const batch = corpsToSeed.slice(i, i + batchSize);
      const stmt = this.db.prepare(
        `INSERT OR IGNORE INTO corp_master (corp_code, stock_code, corp_name, market, is_active, updated_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'))`
      );

      const stmts = batch.map((p) => {
        // corp_code는 stock_code 기반으로 생성 (OpenDART 연동 전까지 임시)
        const corpCode = `KRX_${p.stock_code}`;
        return stmt.bind(corpCode, p.stock_code, p.corp_name!, p.market || 'KOSPI');
      });

      try {
        await this.db.batch(stmts);
      } catch (err) {
        console.error(`[Valuation] corp_master seed batch error:`, err);
      }
    }
  }

  /**
   * corp_master 기준으로 자동 Peer Group 매핑 보정
   * - 수동 매핑이 있는 경우 유지
   * - 매핑이 없는 경우 업종 코드 기반 자동 매핑
   */
  private async ensurePeerMappings(): Promise<void> {
    const corps = await this.db
      .prepare(
        `SELECT corp_code, industry_code
         FROM corp_master
         WHERE is_active = 1 AND stock_code IS NOT NULL`
      )
      .all<{ corp_code: string; industry_code: string | null }>();

    if (!corps.results || corps.results.length === 0) return;

    const existing = await this.db
      .prepare('SELECT corp_code, is_manual FROM corp_peer_map')
      .all<{ corp_code: string; is_manual: number }>();

    const mappedCorps = new Set<string>();
    const manualCorps = new Set<string>();

    for (const row of existing.results || []) {
      mappedCorps.add(row.corp_code);
      if (row.is_manual === 1) {
        manualCorps.add(row.corp_code);
      }
    }

    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO corp_peer_map (corp_code, peer_code, is_manual, mapped_at)
       VALUES (?, ?, 0, ?)`
    );

    const inserts = corps.results
      .filter((corp) => !manualCorps.has(corp.corp_code) && !mappedCorps.has(corp.corp_code))
      .map((corp) => {
        const peerCode = mapIndustryToPeer(corp.industry_code || '');
        return stmt.bind(corp.corp_code, peerCode, now);
      });

    if (inserts.length > 0) {
      await this.db.batch(inserts);
    }
  }

  /**
   * 단일 기업 스냅샷 생성
   */
  private async createSnapshot(
    corpCode: string,
    stockCode: string,
    peerCode: string | null,
    snapDate: string
  ): Promise<ValuationSnapshot | null> {
    // 최신 시세 조회
    const price = await this.db
      .prepare(
        'SELECT * FROM price_daily WHERE stock_code = ? ORDER BY trade_date DESC LIMIT 1'
      )
      .bind(stockCode)
      .first<PriceDaily>();

    if (!price || !price.close_price) {
      return null;
    }

    // TTM 재무 데이터 조회 (없으면 "가격만 있는 스냅샷"으로 저장해 UI가 비지 않게 한다)
    const ttm = await this.db
      .prepare('SELECT * FROM financial_ttm WHERE corp_code = ?')
      .bind(corpCode)
      .first<FinancialTTM>();

    const marketCap = price.market_cap || null;
    const metrics = ttm && marketCap !== null ? this.calculateMetrics(ttm, marketCap) : {
      per_ttm: null,
      pbr: null,
      psr_ttm: null,
      roe_ttm: null,
      opm_ttm: null,
      debt_ratio: null,
    };

    const id = `${corpCode}_${snapDate}`;

    return {
      id,
      corp_code: corpCode,
      snap_date: snapDate,
      market_cap: marketCap,
      price: price.close_price,
      per_ttm: metrics.per_ttm,
      pbr: metrics.pbr,
      psr_ttm: metrics.psr_ttm,
      roe_ttm: metrics.roe_ttm,
      opm_ttm: metrics.opm_ttm,
      debt_ratio: metrics.debt_ratio,
      peer_code: peerCode,
      per_percentile: null,
      pbr_percentile: null,
      psr_percentile: null,
      roe_percentile: null,
      opm_percentile: null,
      valuation_score: null,
      band_label: null,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * 밸류에이션 지표 계산
   */
  calculateMetrics(ttm: FinancialTTM, marketCap: number): ValuationMetrics {
    const metrics: ValuationMetrics = {
      per_ttm: null,
      pbr: null,
      psr_ttm: null,
      roe_ttm: null,
      opm_ttm: null,
      debt_ratio: null,
    };

    // PER (TTM) = 시가총액 / 순이익
    if (ttm.net_profit_ttm && ttm.net_profit_ttm > 0) {
      metrics.per_ttm = Math.round((marketCap / ttm.net_profit_ttm) * 100) / 100;
    }

    // PBR = 시가총액 / 자기자본
    if (ttm.total_equity && ttm.total_equity > 0) {
      metrics.pbr = Math.round((marketCap / ttm.total_equity) * 100) / 100;
    }

    // PSR (TTM) = 시가총액 / 매출
    if (ttm.revenue_ttm && ttm.revenue_ttm > 0) {
      metrics.psr_ttm = Math.round((marketCap / ttm.revenue_ttm) * 100) / 100;
    }

    // ROE (TTM) = 순이익 / 자기자본 × 100
    if (ttm.net_profit_ttm && ttm.total_equity && ttm.total_equity > 0) {
      metrics.roe_ttm = Math.round((ttm.net_profit_ttm / ttm.total_equity) * 10000) / 100;
    }

    // OPM (TTM) = 영업이익 / 매출 × 100
    if (ttm.op_profit_ttm && ttm.revenue_ttm && ttm.revenue_ttm > 0) {
      metrics.opm_ttm = Math.round((ttm.op_profit_ttm / ttm.revenue_ttm) * 10000) / 100;
    }

    // 부채비율 = 부채 / 자기자본 × 100
    if (ttm.total_debt && ttm.total_equity && ttm.total_equity > 0) {
      metrics.debt_ratio = Math.round((ttm.total_debt / ttm.total_equity) * 10000) / 100;
    }

    return metrics;
  }

  /**
   * Peer Group 내 퍼센타일 계산
   */
  calculatePeerPercentiles(snapshots: ValuationSnapshot[]): void {
    if (snapshots.length === 0) return;

    const metrics: (keyof PercentileResult)[] = [
      'per_percentile',
      'pbr_percentile',
      'psr_percentile',
      'roe_percentile',
      'opm_percentile',
    ];

    const valueKeys: Record<keyof PercentileResult, keyof ValuationSnapshot> = {
      per_percentile: 'per_ttm',
      pbr_percentile: 'pbr',
      psr_percentile: 'psr_ttm',
      roe_percentile: 'roe_ttm',
      opm_percentile: 'opm_ttm',
    };

    // PER, PBR, PSR은 역방향 (낮을수록 좋음 → 높은 퍼센타일)
    const invertedMetrics = ['per_percentile', 'pbr_percentile', 'psr_percentile'];

    for (const metric of metrics) {
      const valueKey = valueKeys[metric];

      // 유효한 값을 가진 스냅샷만 필터
      const validSnapshots = snapshots.filter((s) => s[valueKey] !== null && s[valueKey] !== undefined);
      if (validSnapshots.length === 0) continue;

      // 정렬 (오름차순)
      const sorted = [...validSnapshots].sort((a, b) => {
        const aVal = a[valueKey] as number;
        const bVal = b[valueKey] as number;
        return aVal - bVal;
      });

      // 퍼센타일 부여
      const total = sorted.length;
      sorted.forEach((snapshot, index) => {
        let percentile = ((index + 1) / total) * 100;

        // 역방향 지표는 반전
        if (invertedMetrics.includes(metric)) {
          percentile = 100 - percentile;
        }

        snapshot[metric] = Math.round(percentile * 10) / 10;
      });
    }
  }

  /**
   * valuation_score 계산 (가중 평균)
   */
  calculateValuationScore(snapshot: ValuationSnapshot): number {
    let totalWeight = 0;
    let weightedSum = 0;

    // PER (역방향 → 이미 퍼센타일 변환 시 반전됨)
    if (snapshot.per_percentile !== null) {
      weightedSum += snapshot.per_percentile * SCORE_WEIGHTS.per;
      totalWeight += SCORE_WEIGHTS.per;
    }

    // PBR (역방향)
    if (snapshot.pbr_percentile !== null) {
      weightedSum += snapshot.pbr_percentile * SCORE_WEIGHTS.pbr;
      totalWeight += SCORE_WEIGHTS.pbr;
    }

    // PSR (역방향)
    if (snapshot.psr_percentile !== null) {
      weightedSum += snapshot.psr_percentile * SCORE_WEIGHTS.psr;
      totalWeight += SCORE_WEIGHTS.psr;
    }

    // ROE (정방향)
    if (snapshot.roe_percentile !== null) {
      weightedSum += snapshot.roe_percentile * SCORE_WEIGHTS.roe;
      totalWeight += SCORE_WEIGHTS.roe;
    }

    // OPM (정방향)
    if (snapshot.opm_percentile !== null) {
      weightedSum += snapshot.opm_percentile * SCORE_WEIGHTS.opm;
      totalWeight += SCORE_WEIGHTS.opm;
    }

    if (totalWeight === 0) return 50; // 데이터 없으면 중립

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * 스냅샷 배치 저장
   */
  private async batchSaveSnapshots(snapshots: ValuationSnapshot[]): Promise<void> {
    const batchSize = 50;

    for (let i = 0; i < snapshots.length; i += batchSize) {
      const batch = snapshots.slice(i, i + batchSize);
      const stmt = this.db.prepare(
        `INSERT INTO valuation_snapshot
         (id, corp_code, snap_date, market_cap, price, per_ttm, pbr, psr_ttm, roe_ttm, opm_ttm, debt_ratio,
          peer_code, per_percentile, pbr_percentile, psr_percentile, roe_percentile, opm_percentile,
          valuation_score, band_label, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const batchStmts = batch.map((s) =>
        stmt.bind(
          s.id,
          s.corp_code,
          s.snap_date,
          s.market_cap,
          s.price,
          s.per_ttm,
          s.pbr,
          s.psr_ttm,
          s.roe_ttm,
          s.opm_ttm,
          s.debt_ratio,
          s.peer_code,
          s.per_percentile,
          s.pbr_percentile,
          s.psr_percentile,
          s.roe_percentile,
          s.opm_percentile,
          s.valuation_score,
          s.band_label,
          s.created_at
        )
      );

      await this.db.batch(batchStmts);
    }
  }

  /**
   * 시세 데이터 저장 (외부 수집 후 호출)
   */
  async savePriceData(prices: PriceDaily[]): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO price_daily
       (id, stock_code, trade_date, open_price, high_price, low_price, close_price, volume, market_cap, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const batchStmts = prices.map((p) =>
      stmt.bind(
        p.id,
        p.stock_code,
        p.trade_date,
        p.open_price,
        p.high_price,
        p.low_price,
        p.close_price,
        p.volume,
        p.market_cap,
        p.created_at
      )
    );

    await this.db.batch(batchStmts);
  }
}
